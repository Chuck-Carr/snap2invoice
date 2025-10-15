// Helper function for currency formatting
function formatCurrency(amount) {
  return `$${amount.toFixed(2)}`;
}

// PDF text extraction function
async function extractPDFText(pdfFile) {
  try {
    console.log('Starting PDF text extraction...');
    console.log('PDF file size:', pdfFile.size, 'bytes');
    
    // Try multiple methods to import PDF.js
    let pdfjsLib;
    try {
      console.log('Attempting PDF.js import method 1...');
      pdfjsLib = await import('pdfjs-dist/legacy/build/pdf');
      console.log('PDF.js imported successfully with method 1');
    } catch (importError1) {
      console.warn('PDF.js import method 1 failed:', importError1);
      
      try {
        console.log('Attempting PDF.js import method 2...');
        pdfjsLib = await import('pdfjs-dist');
        console.log('PDF.js imported successfully with method 2');
      } catch (importError2) {
        console.error('All PDF.js import methods failed:');
        console.error('Method 1 error:', importError1);
        console.error('Method 2 error:', importError2);
        throw new Error(`PDF.js library not available. Errors: ${importError1.message}, ${importError2.message}`);
      }
    }
    
    // Set up PDF.js worker with local file to avoid version mismatch
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/js/pdf.worker.min.js';
      console.log('PDF.js worker configured with local file');
    } catch (workerError) {
      console.warn('Local worker setup failed, trying CDN fallback:', workerError);
      try {
        // Fallback to CDN with matching version
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@5.4.296/build/pdf.worker.min.mjs';
        console.log('PDF.js worker configured with CDN fallback');
      } catch (cdnError) {
        console.warn('CDN worker also failed, continuing without worker:', cdnError);
      }
    }
    
    console.log('Converting PDF to array buffer...');
    const arrayBuffer = await pdfFile.arrayBuffer();
    console.log('Array buffer created, size:', arrayBuffer.byteLength);
    
    if (arrayBuffer.byteLength === 0) {
      throw new Error('PDF file appears to be empty');
    }
    
    console.log('Loading PDF document...');
    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer,
      // Add some options to handle problematic PDFs
      disableFontFace: true,
      nativeImageDecoderSupport: 'none'
    }).promise;
    
    console.log('PDF loaded successfully, pages:', pdf.numPages);
    
    if (pdf.numPages === 0) {
      throw new Error('PDF has no pages');
    }
    
    let fullText = '';
    
    // Extract text from each page
    for (let i = 1; i <= Math.min(pdf.numPages, 5); i++) { // Limit to first 5 pages
      console.log(`Extracting text from page ${i}...`);
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        console.log(`Page ${i} has ${textContent.items.length} text items`);
        
        if (textContent.items.length === 0) {
          console.log(`Page ${i} has no text items - may be a scanned image`);
          continue;
        }
        
        const pageText = textContent.items.map(item => {
          if (item.str && item.str.trim()) {
            console.log('Text item:', item.str.trim());
            return item.str.trim();
          }
          return '';
        }).filter(text => text.length > 0).join(' ');
        
        console.log(`Page ${i} extracted text (first 100 chars):`, pageText.substring(0, 100));
        if (pageText.trim()) {
          fullText += pageText + '\n';
        }
      } catch (pageError) {
        console.error(`Error processing page ${i}:`, pageError);
        continue; // Skip this page and try the next one
      }
    }
    
    const finalText = fullText.trim();
    console.log('Final extracted text length:', finalText.length);
    console.log('Final extracted text preview:', finalText.substring(0, 200));
    
    if (finalText.length === 0) {
      throw new Error('No text found in PDF - may be a scanned image');
    }
    
    return finalText;
  } catch (error) {
    console.error('PDF text extraction failed:', error);
    console.error('Error details:', error.message, error.stack);
    throw new Error(`Could not extract text from PDF: ${error.message}`);
  }
}

// PDF to image conversion function
async function convertPDFToImage(pdfFile) {
  try {
    console.log('Starting PDF to image conversion...');
    
    // Import PDF.js
    let pdfjsLib;
    try {
      pdfjsLib = await import('pdfjs-dist/legacy/build/pdf');
    } catch (importError) {
      pdfjsLib = await import('pdfjs-dist');
    }
    
    // Set up worker with local file to avoid version mismatch
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/js/pdf.worker.min.js';
      console.log('PDF.js worker configured with local file for image conversion');
    } catch (workerError) {
      console.warn('Local worker setup failed, trying CDN fallback:', workerError);
      try {
        // Fallback to CDN with matching version
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@5.4.296/build/pdf.worker.min.mjs';
        console.log('PDF.js worker configured with CDN fallback for image conversion');
      } catch (cdnError) {
        console.warn('CDN worker also failed, continuing without worker:', cdnError);
      }
    }
    
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer,
      disableFontFace: true,
      nativeImageDecoderSupport: 'none'
    }).promise;
    
    console.log('PDF loaded for image conversion, pages:', pdf.numPages);
    
    // Get the first page
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better OCR
    
    // Create canvas
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    console.log('Rendering PDF page to canvas:', viewport.width, 'x', viewport.height);
    
    // Render page to canvas
    const renderContext = {
      canvasContext: context,
      viewport: viewport
    };
    
    await page.render(renderContext).promise;
    
    console.log('PDF page rendered to canvas successfully');
    
    // Convert canvas to blob
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          console.log('PDF converted to image blob, size:', blob.size);
          resolve(blob);
        } else {
          reject(new Error('Failed to convert canvas to blob'));
        }
      }, 'image/png');
    });
    
  } catch (error) {
    console.error('PDF to image conversion failed:', error);
    throw new Error(`Could not convert PDF to image: ${error.message}`);
  }
}

// Image preprocessing function
async function preprocessImage(imageFile) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      // Set canvas size
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Draw original image
      ctx.drawImage(img, 0, 0);
      
      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Convert to grayscale and increase contrast
      for (let i = 0; i < data.length; i += 4) {
        // Convert to grayscale
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        
        // Increase contrast (simple threshold)
        const threshold = 128;
        const processed = gray > threshold ? 255 : 0;
        
        data[i] = processed;     // Red
        data[i + 1] = processed; // Green
        data[i + 2] = processed; // Blue
        // Alpha stays the same
      }
      
      // Put processed image data back
      ctx.putImageData(imageData, 0, 0);
      
      // Convert canvas to blob
      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/png');
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image for preprocessing'));
    };
    
    // Load the image
    img.src = URL.createObjectURL(imageFile);
  });
}

export async function processReceiptOCR(imageFile) {
  try {
    // Validate file type
    if (!imageFile) {
      throw new Error('No image file provided');
    }
    
    // Check for HEIC files (common on iPhone)
    if (imageFile.name && imageFile.name.toLowerCase().endsWith('.heic')) {
      throw new Error('HEIC format not supported. Please convert to JPG or change iPhone camera settings to "Most Compatible" format.');
    }
    
    if (!imageFile.type.startsWith('image/') && imageFile.type !== 'application/pdf') {
      throw new Error(`Unsupported file type: ${imageFile.type}. Please use JPG, PNG, WebP, or PDF format.`);
    }

    // Check file size (max 10MB)
    if (imageFile.size > 10 * 1024 * 1024) {
      throw new Error('Image file too large (max 10MB)');
    }

    console.log('🚀 Starting OCR processing for:', imageFile.name, imageFile.type);
    
    // Use Google Vision exclusively
    console.log('🎯 Using Google Vision API exclusively...');
    const googleResult = await processImageWithGoogleVision(imageFile);
    console.log('✅ Google Vision completed! Confidence:', googleResult.confidence + '%');
    return googleResult;
    
    // Dynamically import Tesseract.js for client-side only
    let Tesseract;
    try {
      const tesseractModule = await import('tesseract.js');
      Tesseract = tesseractModule.default || tesseractModule;
      
      if (!Tesseract || typeof Tesseract.recognize !== 'function') {
        throw new Error('Tesseract.js failed to load properly');
      }
    } catch (importError) {
      console.error('Failed to import Tesseract.js:', importError);
      throw new Error('OCR library failed to load. Please try refreshing the page.');
    }
    
    // Handle PDFs and images differently
    let processedFile;
    
    if (imageFile.type === 'application/pdf') {
      console.log('Processing PDF...');
      try {
        // First try to extract text directly from PDF
        console.log('Attempting direct PDF text extraction...');
        const pdfText = await extractPDFText(imageFile);
        
        console.log('PDF extraction result - text length:', pdfText?.length || 0);
        
        if (pdfText && pdfText.length > 10) {
          console.log('Successfully extracted text from PDF:', pdfText.substring(0, 100) + '...');
          // Return the extracted text directly without using Tesseract
          return {
            text: pdfText,
            confidence: 95, // High confidence for direct text extraction
            success: true,
            source: 'pdf-text-extraction'
          };
        } else {
          console.log('PDF text extraction returned minimal or no text:', pdfText?.length || 0, 'characters');
          console.log('Converting PDF to image for OCR...');
          processedFile = await convertPDFToImage(imageFile);
        }
      } catch (pdfError) {
        console.error('PDF text extraction failed, converting to image for OCR:', pdfError);
        console.error('Will attempt PDF-to-image conversion and OCR');
        try {
          processedFile = await convertPDFToImage(imageFile);
        } catch (conversionError) {
          console.error('PDF to image conversion also failed:', conversionError);
          throw new Error('Cannot process PDF: Both text extraction and image conversion failed');
        }
      }
    } else {
      // Preprocess images for better OCR results
      console.log('Preprocessing image for better OCR...');
      processedFile = await preprocessImage(imageFile);
    }
    
    // Create URL for Tesseract
    const imageUrl = URL.createObjectURL(processedFile);
    
    try {
      // Enhanced OCR options specifically tuned for receipts and PDFs
      const isPDF = imageFile.type === 'application/pdf';
      console.log('Processing file type:', imageFile.type, 'isPDF:', isPDF);
      
      const ocrOptions = {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          } else if (m.status) {
            console.log('OCR Status:', m.status);
          }
        },
        // Receipt-specific OCR configuration
        tessedit_pageseg_mode: isPDF ? 1 : 6, // Auto page segmentation for PDFs, uniform block for images
        tessedit_ocr_engine_mode: 2, // Neural nets LSTM engine only
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,$/:-+%#()[]{}| ',
        preserve_interword_spaces: '1',
        // Additional parameters for better receipt recognition
        textord_min_linesize: isPDF ? '1.0' : '2.5', // Smaller line size for PDFs
        textord_old_xheight: '0',
        classify_enable_learning: '0'
      };
      
      console.log('OCR options for', isPDF ? 'PDF' : 'image', ':', ocrOptions);
      
      console.log('Starting OCR with enhanced options...');
      let result;
      
      try {
        // First attempt with receipt-specific settings
        console.log('Attempt 1: Receipt-specific OCR settings...');
        result = await Tesseract.recognize(imageUrl, 'eng', ocrOptions);
        
        // If confidence is very low, try alternative settings
        if (result.data.confidence < 30) {
          console.log('Low confidence, trying alternative OCR settings...');
          
          const alternativeOptions = {
            logger: ocrOptions.logger,
            tessedit_pageseg_mode: 7, // Single text line
            tessedit_ocr_engine_mode: 1, // Neural nets LSTM engine + Legacy engine
            tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,$/: '
          };
          
          const alternativeResult = await Tesseract.recognize(imageUrl, 'eng', alternativeOptions);
          
          // Use whichever result has higher confidence
          if (alternativeResult.data.confidence > result.data.confidence) {
            console.log(`Alternative approach better: ${alternativeResult.data.confidence}% vs ${result.data.confidence}%`);
            result = alternativeResult;
          }
        }
      } catch (ocrError) {
        console.error('Primary OCR failed, trying fallback approach...');
        
        // Fallback with most basic settings
        const basicOptions = {
          logger: ocrOptions.logger,
          tessedit_pageseg_mode: 1, // Automatic page segmentation with OSD
          tessedit_ocr_engine_mode: 3 // Default, based on what is available
        };
        
        result = await Tesseract.recognize(imageUrl, 'eng', basicOptions);
      }
      
      // Clean up the object URL
      URL.revokeObjectURL(imageUrl);
      
      console.log('OCR completed. Confidence:', result.data.confidence);
      console.log('OCR Full Text:', result.data.text);
      console.log('OCR Text preview:', result.data.text.substring(0, 200) + '...');
      
      // Accept results with lower confidence for receipts (they can be challenging)
      if (!result || !result.data || !result.data.text) {
        throw new Error('No text found in image');
      }
      
      // Even with low confidence, if we got some text, let's try to process it
      const hasUsefulText = result.data.text.trim().length > 10;
      const hasNumbers = /\d/.test(result.data.text);
      
      if (!hasUsefulText || !hasNumbers) {
        console.warn('OCR result may not be useful:', {
          textLength: result.data.text.length,
          hasNumbers,
          confidence: result.data.confidence
        });
      }
      
      console.log('OCR Success! Text length:', result.data.text.length, 'Confidence:', result.data.confidence + '%');
      
      return {
        text: result.data.text.trim(),
        confidence: result.data.confidence,
        success: true,
        lowConfidence: result.data.confidence < 50
      };
    } catch (ocrError) {
      // Clean up the object URL on error
      URL.revokeObjectURL(imageUrl);
      throw ocrError;
    }
    
  } catch (error) {
    console.error('OCR processing failed:', error);
    return {
      text: '',
      confidence: 0,
      success: false,
      error: error.message
    };
  }
}

// Import enhanced extraction
import { extractReceiptDataEnhanced } from './ocr-enhanced.js';
// Import Google Vision
import { processImageWithGoogleVision, testGoogleVisionConnection } from './ocr-google.js';

export function extractReceiptData(ocrText) {
  console.log('🚨🚨🚨 FORCING ENHANCED EXTRACTION 🚨🚨🚨');
  console.log('Raw OCR text:', ocrText.substring(0, 200) + '...');
  
  // Call enhanced extraction directly
  const result = extractReceiptDataEnhanced(ocrText);
  
  console.log('🔥 ENHANCED RESULT:', {
    items: result.items.length,
    total: result.total,
    firstItem: result.items[0]?.description
  });
  
  return result;
}

export function generateInvoiceItems(extractedData) {
  const items = [];

  // Add extracted items
  extractedData.items.forEach((item, index) => {
    items.push({
      id: `item-${index}`,
      description: item.description,
      quantity: 1,
      rate: item.amount,
      amount: item.amount
    });
  });

  // If no items were extracted, create a general item with the total
  if (items.length === 0 && extractedData.total > 0) {
    items.push({
      id: 'item-0',
      description: `Services/Products from ${extractedData.merchantName || 'Merchant'}`,
      quantity: 1,
      rate: extractedData.total - (extractedData.tax || 0),
      amount: extractedData.total - (extractedData.tax || 0)
    });
  }

  return items;
}