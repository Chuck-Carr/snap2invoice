import { NextResponse } from 'next/server';
import vision from '@google-cloud/vision';
import path from 'path';

// Initialize the client
let visionClient = null;

function initializeGoogleVision() {
  try {
    // Try to initialize with service account key
    const keyPath = path.join(process.cwd(), 'google-vision-key.json');
    
    // Debug: Check if key file exists and read project info
    const fs = require('fs');
    let keyContent = null;
    
    if (fs.existsSync(keyPath)) {
      keyContent = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
      console.log('🔑 Service account project:', keyContent.project_id);
      console.log('🔑 Service account email:', keyContent.client_email);
    } else {
      console.error('❌ Key file not found at:', keyPath);
      return false;
    }
    
    visionClient = new vision.ImageAnnotatorClient({
      keyFilename: keyPath,
      projectId: keyContent.project_id // Explicitly set project ID
    });
    
    console.log('✅ Google Vision API initialized successfully');
    return true;
  } catch (error) {
    console.warn('⚠️ Google Vision API not available:', error.message);
    console.warn('Stack:', error.stack);
    return false;
  }
}

export async function POST(request) {
  try {
    // Initialize Google Vision if not already done
    if (!visionClient) {
      const initialized = initializeGoogleVision();
      if (!initialized) {
        return NextResponse.json({
          success: false,
          error: 'Google Vision API not configured. Please add google-vision-key.json to project root.'
        }, { status: 500 });
      }
    }

    // Get the image data from the request
    const formData = await request.formData();
    const imageFile = formData.get('image');
    
    if (!imageFile) {
      return NextResponse.json({
        success: false,
        error: 'No image file provided'
      }, { status: 400 });
    }

    console.log('🔍 Processing image with Google Vision API...');
    console.log('📄 Image size:', imageFile.size, 'bytes');
    console.log('📋 Image type:', imageFile.type);
    
    // Special handling for PDFs
    if (imageFile.type === 'application/pdf') {
      console.log('📄 PDF detected - Google Vision may have issues with PDFs');
      console.log('🔄 Consider converting PDF to image first');
    }

    // Convert File to buffer - Google Vision can handle PDFs directly
    console.log('🔄 Processing with Google Vision (supports PDFs natively)...');
    const imageBuffer = await imageFile.arrayBuffer();
    
    // Debug the buffer
    console.log('📊 Buffer info:', {
      bufferSize: imageBuffer.byteLength,
      fileSize: imageFile.size,
      sizesMatch: imageBuffer.byteLength === imageFile.size,
      bufferPreview: new Uint8Array(imageBuffer.slice(0, 20))
    });
    
    // Check Google Vision limits (max 20MB for PDFs)
    if (imageBuffer.byteLength > 20 * 1024 * 1024) {
      console.error('❌ File too large for Google Vision:', imageBuffer.byteLength, 'bytes (max 20MB)');
      return NextResponse.json({
        success: false,
        error: 'File too large for Google Vision API (max 20MB)'
      }, { status: 400 });
    }
    
    // Try document text detection first (better for receipts/PDFs)
    console.log('📄 Trying document text detection first...');
    
    // Create buffer for Google Vision
    const buffer = Buffer.from(imageBuffer);
    console.log('💻 Sending as buffer, length:', buffer.length);
    
    let [result] = await visionClient.documentTextDetection({
      image: {
        content: buffer
      }
    });
    
    // If no text found, try regular text detection as fallback
    if (!result.textAnnotations || result.textAnnotations.length === 0) {
      console.log('🔄 Document detection failed, trying regular text detection...');
      
      const [fallbackResult] = await visionClient.textDetection({
        image: {
          content: buffer
        }
      });
      
      result = fallbackResult;
      console.log('🔍 Regular text detection result:', {
        hasText: !!(fallbackResult.textAnnotations?.length || fallbackResult.fullTextAnnotation?.text)
      });
    }

    const detections = result.textAnnotations;
    
    console.log('🔍 Google Vision raw result:', {
      hasDetections: !!detections,
      detectionsLength: detections?.length || 0,
      fullTextLength: detections?.[0]?.description?.length || 0,
      fullTextAnnotation: !!result.fullTextAnnotation,
      fullTextAnnotationLength: result.fullTextAnnotation?.text?.length || 0,
      resultKeys: Object.keys(result || {})
    });
    
    // Log the complete result structure for debugging
    console.log('🔍 Complete Google Vision result structure:');
    console.log('- textAnnotations:', result.textAnnotations?.length || 0, 'items');
    console.log('- fullTextAnnotation exists:', !!result.fullTextAnnotation);
    console.log('- fullTextAnnotation.text length:', result.fullTextAnnotation?.text?.length || 0);
    
    // Check for errors
    if (result.error) {
      console.log('❌ Google Vision returned error:', result.error);
    }
    
    // Log first few characters if text exists anywhere
    if (result.fullTextAnnotation?.text) {
      console.log('- fullTextAnnotation preview:', result.fullTextAnnotation.text.substring(0, 100));
    }
    if (result.textAnnotations?.[0]?.description) {
      console.log('- textAnnotations preview:', result.textAnnotations[0].description.substring(0, 100));
    }
    
    if (!detections || detections.length === 0) {
      // Try alternative detection methods
      console.log('⚠️ No textAnnotations, trying alternative detection...');
      
      // Check if there are other detection results
      if (result.fullTextAnnotation?.text) {
        console.log('✅ Found text in fullTextAnnotation');
        const alternativeText = result.fullTextAnnotation.text;
        return NextResponse.json({
          success: true,
          text: alternativeText.trim(),
          confidence: 90,
          source: 'google-vision-fulltext'
        });
      }
      
      console.log('❌ Truly no text detected');
      return NextResponse.json({
        success: false,
        error: 'No text detected in image'
      }, { status: 422 });
    }

    // The first detection contains all text
    const fullText = detections[0].description;
    
    // Calculate confidence based on detection quality
    const confidence = detections.length > 5 ? 95 : 85; // High confidence for Google Vision
    
    console.log('✅ Google Vision processing complete');
    console.log('📄 Text length:', fullText.length);
    console.log('🎯 Confidence:', confidence + '%');
    
    return NextResponse.json({
      success: true,
      text: fullText.trim(),
      confidence: confidence,
      source: 'google-vision'
    });

  } catch (error) {
    console.error('❌ Google Vision API error:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Google Vision processing failed'
    }, { status: 500 });
  }
}

// Test endpoint
export async function GET() {
  try {
    if (!visionClient) {
      const initialized = initializeGoogleVision();
      if (!initialized) {
        return NextResponse.json({
          available: false,
          message: 'Google Vision API not configured'
        });
      }
    }
    
    return NextResponse.json({
      available: true,
      message: 'Google Vision API is ready'
    });
    
  } catch (error) {
    return NextResponse.json({
      available: false,
      message: error.message
    });
  }
}