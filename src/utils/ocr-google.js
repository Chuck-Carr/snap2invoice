// Client-side Google Vision integration via API route

export async function processImageWithGoogleVision(imageFile) {
  try {
    console.log('🔍 Calling Google Vision API via server...');
    
    // Create FormData for the API call
    const formData = new FormData();
    formData.append('image', imageFile);
    
    // Call our server-side API route
    const response = await fetch('/api/ocr-google', {
      method: 'POST',
      body: formData,
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Google Vision API failed');
    }
    
    console.log('✅ Google Vision processing complete');
    console.log('📄 Text length:', result.text.length);
    console.log('🎯 Confidence:', result.confidence + '%');
    
    return {
      text: result.text,
      confidence: result.confidence,
      success: true,
      source: result.source
    };

  } catch (error) {
    console.error('❌ Google Vision API error:', error);
    throw error;
  }
}

export async function testGoogleVisionConnection() {
  try {
    console.log('🧪 Testing Google Vision connection...');
    
    // Test the API availability
    const response = await fetch('/api/ocr-google', {
      method: 'GET',
    });
    
    const result = await response.json();
    
    if (result.available) {
      console.log('✅ Google Vision connection successful!');
      return true;
    } else {
      console.log('❌ Google Vision not available:', result.message);
      return false;
    }
  } catch (error) {
    console.log('❌ Google Vision connection failed:', error.message);
    return false;
  }
}
