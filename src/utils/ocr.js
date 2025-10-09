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

    console.log('Starting OCR processing for:', imageFile.name, imageFile.type);
    
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

export function extractReceiptData(ocrText) {
  const lines = ocrText.split('\n').map(line => line.trim()).filter(line => line);
  
  console.log('OCR Extraction Debug - Raw lines:', lines);
  
  const extractedData = {
    merchantName: '',
    items: [],
    total: 0,
    tax: 0,
    date: null,
    address: ''
  };

  // Enhanced patterns for extraction with more variations
  const totalPattern = /(?:total|amount|sum|balance|due|grand)[\s:$]*([\d,]+\.?\d*)/i;
  // Alternative patterns for OCR misreads of TOTAL
  const totalPatternAlt = /(?:t0tal|t0t4l|t07al|t074l|t0741|to7al|to74l|70tal|7otal|tota1|t0ta1)[\s:$]*([\d,]+\.?\d*)/i;
  const subtotalPattern = /(?:subtotal|sub\s*total|sub)[\s:$]*([\d,]+\.?\d*)/i;
  const taxPattern = /(?:tax|vat|sales\s*tax|hst|gst|pst)[\s:$]*([\d,]+\.?\d*)/i;
  const datePattern = /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})|((jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s*\d{1,2},?\s*\d{2,4})/i;
  const timePattern = /(\d{1,2}:\d{2}\s*(am|pm)?)/i;
  // More flexible price patterns
  const pricePattern = /\$?[\d,]+\.\d{2}/g;
  const dollarSignPattern = /\$\s*([\d,]+\.?\d*)/g;
  
  // Patterns to exclude from item extraction
  const excludeFromItemsPattern = /(?:total|subtotal|sub\s*total|tax|vat|sales\s*tax|amount|sum|balance|due|change|cash|credit|debit|tender|usd\$|usb\$|u5d\$|u50\$|payment|paid|auth\s*code|card|visa|mastercard|discover|amex|home\s*depot|walmart|target|costco)/i;
  
  // Additional patterns for payment methods and receipt footers
  const paymentMethodPattern = /(?:usd\$|usb\$|u5d\$|u50\$|card\s*#|auth\s*code|approval|transaction|ref\s*#|batch|seq|terminal)/i;
  const receiptFooterPattern = /(?:thank\s*you|visit|return\s*policy|policy\s*id|days|expires|barcode|^\d{4}\s+\d{2}\/\d{2}\/\d{2})/i;

  // Extract merchant name - try multiple approaches
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i];
    // Skip lines that look like addresses, phone numbers, or other metadata
    if (line.length > 3 && 
        !line.match(/^\d+\s/) && // Not starting with street number
        !line.match(/^\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{4}/) && // Not a phone number
        !line.match(/^(mon|tue|wed|thu|fri|sat|sun)/i) && // Not days of week
        !line.match(/^(www\.|http)/i) && // Not a website
        !line.toLowerCase().includes('receipt') &&
        !line.toLowerCase().includes('invoice') &&
        !line.match(/[\d.]+/) && // Avoid lines with numbers/prices
        line.length < 50) { // Reasonable business name length
      
      // Clean up common OCR artifacts
      let cleanName = line.trim()
        .replace(/[\|\[\]{}]/g, '') // Remove brackets and pipes
        .replace(/[£€¢]/g, '$') // Convert currency symbols
        .replace(/\s+/g, ' ') // Normalize spaces
        .replace(/^[^a-zA-Z]+/, '') // Remove leading non-letters
        .replace(/[^a-zA-Z\s]+$/, ''); // Remove trailing non-letters
      
      if (cleanName.length > 2) {
        extractedData.merchantName = cleanName;
        console.log('Extracted and cleaned merchant name:', extractedData.merchantName);
        break;
      }
    }
  }

  // Extract date
  for (const line of lines) {
    const dateMatch = line.match(datePattern);
    if (dateMatch) {
      extractedData.date = dateMatch[1];
      break;
    }
  }

  // Extract total
  for (const line of lines) {
    const totalMatch = line.match(totalPattern) || line.match(totalPatternAlt);
    if (totalMatch) {
      extractedData.total = parseFloat(totalMatch[1]);
      break;
    }
  }

  // Extract tax
  for (const line of lines) {
    const taxMatch = line.match(taxPattern);
    if (taxMatch) {
      extractedData.tax = parseFloat(taxMatch[1]);
      break;
    }
  }

  // Find the total line to stop processing items after it
  let totalLineIndex = -1;
  lines.forEach((line, index) => {
    if ((line.match(totalPattern) || line.match(totalPatternAlt)) && totalLineIndex === -1) {
      totalLineIndex = index;
      console.log(`Found TOTAL line at index ${index}: "${line}"`);
    }
  });
  
  // Enhanced item extraction approach
  // Try to find lines with product descriptions and prices
  const potentialItems = [];
  
  lines.forEach((line, index) => {
    // Skip processing if we're at or after the TOTAL line
    if (totalLineIndex >= 0 && index >= totalLineIndex) {
      console.log(`Line ${index}: "${line}" - SKIPPED (after TOTAL line)`);
      return;
    }
    
    const prices = line.match(pricePattern);
    console.log(`Line ${index}: "${line}" - Found prices:`, prices);
    
    if (prices) {
      const isTotal = line.match(totalPattern);
      const isSubtotal = line.match(subtotalPattern);
      const isTax = line.match(taxPattern);
      const isExcluded = line.match(excludeFromItemsPattern);
      const isPaymentMethod = line.match(paymentMethodPattern);
      const isReceiptFooter = line.match(receiptFooterPattern);
      
      console.log(`  - isTotal: ${!!isTotal}, isSubtotal: ${!!isSubtotal}, isTax: ${!!isTax}, isExcluded: ${!!isExcluded}, isPayment: ${!!isPaymentMethod}, isFooter: ${!!isReceiptFooter}`);
      
      if (!isTotal && !isSubtotal && !isTax && !isExcluded && !isPaymentMethod && !isReceiptFooter) {
        // Try to extract item description and price
        const lastPrice = prices[prices.length - 1];
        let description = line.replace(lastPrice, '').trim();
        
        // Clean up the description
        description = description
          .replace(/^[\d\s\-\.#]*/, '') // Remove leading numbers, spaces, dashes, dots, hash
          .replace(/[\s\-\.]*$/, '') // Remove trailing spaces, dashes, dots
          .replace(/\s+/g, ' ') // Normalize spaces
          .trim();
        
        console.log(`  - Potential item: "${description}" - ${lastPrice}`);
        
        // More lenient filtering for item descriptions
        if (description && 
            description.length > 1 && 
            !description.match(/^\d+$/) && // Not just numbers
            !description.match(/^[\s\-\.#]+$/) && // Not just spaces/dashes/dots/hash
            !description.match(/^[x]+$/i) && // Not just X's
            !description.toLowerCase().includes('change') &&
            !description.toLowerCase().includes('tender') &&
            !description.toLowerCase().includes('usd') &&
            !description.toLowerCase().includes('auth') &&
            !description.toLowerCase().includes('approval') &&
            !description.toLowerCase().includes('transaction') &&
            description.length < 100) { // Reasonable item description length
          
          console.log(`  ✅ Adding item: "${description}" - $${parseFloat(lastPrice.replace('$', ''))}`);
          
          extractedData.items.push({
            description: description,
            amount: parseFloat(lastPrice.replace('$', ''))
          });
        } else {
          console.log(`  ❌ Filtered out: "${description}"`);
          // Store for potential fallback use
          potentialItems.push({
            line: line,
            price: parseFloat(lastPrice.replace('$', '')),
            index: index
          });
        }
      } else {
        let reason = '';
        if (isTotal) reason += 'total ';
        if (isSubtotal) reason += 'subtotal ';
        if (isTax) reason += 'tax ';
        if (isExcluded) reason += 'excluded-pattern ';
        if (isPaymentMethod) reason += 'payment-method ';
        if (isReceiptFooter) reason += 'receipt-footer ';
        console.log(`  ❌ Excluded as: ${reason.trim()}`);
      }
    }
  });
  
  // If we didn't find enough items, look for product descriptions in lines without prices
  if (extractedData.items.length === 0) {
    console.log('No items found with price patterns, looking for product descriptions...');
    
    // Look for lines that might be product descriptions (before price lines)
    lines.forEach((line, index) => {
      if (totalLineIndex >= 0 && index >= totalLineIndex) return;
      
      // Skip lines with prices, totals, etc.
      if (line.match(pricePattern) || 
          line.match(totalPattern) || 
          line.match(totalPatternAlt) ||
          line.match(subtotalPattern) ||
          line.match(taxPattern) ||
          line.match(excludeFromItemsPattern) ||
          line.match(paymentMethodPattern) ||
          line.match(receiptFooterPattern)) {
        return;
      }
      
      // Look for lines that could be product descriptions
      const cleanLine = line.trim()
        .replace(/^[\d\s\-\.#]*/, '') // Remove leading numbers, spaces, dashes, dots, hash
        .replace(/[\s\-\.]*$/, '') // Remove trailing spaces, dashes, dots
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim();
      
      // Check if this looks like a product name/description
      if (cleanLine.length > 3 && 
          cleanLine.length < 80 && 
          !cleanLine.match(/^\d+$/) && // Not just numbers
          !cleanLine.match(/^[\s\-\.#]+$/) && // Not just punctuation
          !cleanLine.toLowerCase().includes('receipt') &&
          !cleanLine.toLowerCase().includes('invoice') &&
          !cleanLine.toLowerCase().includes('thank') &&
          !cleanLine.toLowerCase().includes('policy') &&
          !cleanLine.toLowerCase().includes('return') &&
          !cleanLine.toLowerCase().includes('visit') &&
          !cleanLine.toLowerCase().includes('phone') &&
          !cleanLine.toLowerCase().includes('www') &&
          !cleanLine.toLowerCase().includes('http') &&
          !cleanLine.toLowerCase().includes('@') &&
          !cleanLine.match(/^\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{4}/) && // Not phone number
          !cleanLine.match(/^\d+\s+\w+\s+(st|ave|rd|blvd|dr|ln)/i)) { // Not address
        
        // Check if there's a price in the next few lines
        let foundPrice = null;
        for (let j = index + 1; j < Math.min(index + 4, lines.length); j++) {
          if (totalLineIndex >= 0 && j >= totalLineIndex) break;
          const nextLine = lines[j];
          const nextPrices = nextLine.match(pricePattern);
          if (nextPrices && !nextLine.match(totalPattern) && !nextLine.match(subtotalPattern) && !nextLine.match(taxPattern)) {
            foundPrice = parseFloat(nextPrices[nextPrices.length - 1].replace('$', ''));
            console.log(`Found product description "${cleanLine}" with price ${foundPrice} in next line`);
            break;
          }
        }
        
        if (foundPrice) {
          extractedData.items.push({
            description: cleanLine,
            amount: foundPrice
          });
          console.log(`  ✅ Added separated item: "${cleanLine}" - $${foundPrice}`);
        }
      }
    });
  }

  // Always try fallback extraction to catch more data
  console.log('Trying enhanced extraction methods...');
  console.log('Raw OCR text for analysis:', ocrText);
  
  // Try multiple patterns for dollar amounts
  const allDollarAmounts = [];
  
  // Pattern 1: Standard $XX.XX format
  const dollarMatches1 = ocrText.match(/\$[\d,]+\.\d{2}/g);
  // Pattern 2: Numbers followed by decimal (common OCR miss of $ sign)
  const dollarMatches2 = ocrText.match(/\b\d+\.\d{2}\b/g);
  // Pattern 3: Any number that looks like money with spaces
  const dollarMatches3 = ocrText.match(/\b\d{1,4}\s*\.\s*\d{2}\b/g);
  // Pattern 4: Currency symbols that might be misread (£, €, etc.) followed by numbers
  const dollarMatches4 = ocrText.match(/[£€¢]\s*[\d,]+\.\d{2}/g);
  
  const allMatches = [
    ...(dollarMatches1 || []),
    ...(dollarMatches2 || []),
    ...(dollarMatches3 || []),
    ...(dollarMatches4 || [])
  ];
  
  console.log('Found potential dollar amounts:', allMatches);
  
  if (allMatches.length > 0) {
    allMatches.forEach(match => {
      // Clean the match - remove currency symbols and spaces
      const cleanMatch = match.replace(/[£€¢$,\s]/g, '');
      const amount = parseFloat(cleanMatch);
      console.log(`Processing potential amount: "${match}" -> ${amount}`);
      
      if (amount > 0 && amount < 1000) { // Reasonable range for most receipts
        allDollarAmounts.push(amount);
      }
    });
    
    // If we found dollar amounts, organize them properly
    if (allDollarAmounts.length > 0) {
      allDollarAmounts.sort((a, b) => b - a);
      
      console.log('All dollar amounts found:', allDollarAmounts);
      
      // If we haven't found a total yet, use the highest amount
      if (extractedData.total === 0) {
        extractedData.total = allDollarAmounts[0];
        console.log('Set total from fallback:', extractedData.total);
      }
      
      // Create items from the amounts we found
      if (extractedData.items.length === 0) {
        console.log('No items extracted from descriptions, creating fallback items from amounts');
        
        // Try to find potential product names in the OCR text to use as descriptions
        const productKeywords = [];
        const textLines = ocrText.split('\n').map(line => line.trim()).filter(line => line);
        
        textLines.forEach(line => {
          // Look for lines that might contain product names
          const cleanLine = line
            .replace(/\$[\d,]+\.\d{2}/g, '') // Remove prices
            .replace(/\b\d+\.\d{2}\b/g, '') // Remove decimal numbers
            .replace(/^[\d\s\-\.#]*/, '') // Remove leading numbers, spaces, dashes, dots, hash
            .replace(/[\s\-\.]*$/, '') // Remove trailing spaces, dashes, dots
            .replace(/\s+/g, ' ') // Normalize spaces
            .trim();
          
          // Check if this could be a product name
          if (cleanLine.length > 3 && 
              cleanLine.length < 60 && 
              !cleanLine.toLowerCase().includes('total') &&
              !cleanLine.toLowerCase().includes('tax') &&
              !cleanLine.toLowerCase().includes('receipt') &&
              !cleanLine.toLowerCase().includes('invoice') &&
              !cleanLine.toLowerCase().includes('thank') &&
              !cleanLine.toLowerCase().includes('visit') &&
              !cleanLine.toLowerCase().includes('policy') &&
              !cleanLine.toLowerCase().includes('phone') &&
              !cleanLine.toLowerCase().includes('www') &&
              !cleanLine.toLowerCase().includes('auth') &&
              !cleanLine.toLowerCase().includes('approval') &&
              !cleanLine.toLowerCase().includes('transaction') &&
              !cleanLine.match(/^\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{4}/) && // Not phone number
              !cleanLine.match(/^\d+\s+\w+\s+(st|ave|rd|blvd|dr|ln)/i) && // Not address
              cleanLine.match(/[a-zA-Z]/) && // Contains letters
              !cleanLine.match(/^[\d\s\-\.#]+$/)) { // Not just punctuation and numbers
            
            productKeywords.push(cleanLine);
          }
        });
        
        console.log('Found potential product keywords:', productKeywords);
        
        if (allDollarAmounts.length > 1) {
          // Multiple amounts - create items with found descriptions or generic ones
          allDollarAmounts.forEach((amount, index) => {
            if (index === 0 && allDollarAmounts.length > 1) {
              // First (highest) amount might be total, use second amount for first item
              const subtotalAmount = allDollarAmounts[1];
              const description = productKeywords[0] || 
                                 (extractedData.merchantName ? 
                                  `Product/Service from ${extractedData.merchantName}` : 
                                  'Product/Service');
              
              extractedData.items.push({
                description: description,
                amount: subtotalAmount
              });
            } else if (index > 1) {
              // Additional items with available descriptions
              const keywordIndex = Math.min(index - 1, productKeywords.length - 1);
              const description = productKeywords[keywordIndex] || 
                                 (productKeywords.length > 0 ? 
                                  `${productKeywords[0]} - Additional Item` : 
                                  `Additional Item (${formatCurrency(amount)})`);
              
              extractedData.items.push({
                description: description,
                amount: amount
              });
            }
            // Skip index 1 as it's used for the first item
          });
        } else {
          // Single amount - create one item with best available description
          const description = productKeywords[0] || 
                             (extractedData.merchantName ? 
                              `Services/Products from ${extractedData.merchantName}` : 
                              'Services/Products');
          
          extractedData.items.push({
            description: description,
            amount: allDollarAmounts[0]
          });
        }
        
        console.log('Created items from fallback with enhanced descriptions:', extractedData.items);
      }
    }
  } else {
    console.log('No dollar amounts found in OCR text');
    // Log the OCR text to see what we're working with
    console.log('OCR text lines for manual inspection:');
    ocrText.split('\n').forEach((line, index) => {
      console.log(`Line ${index}: "${line}"`);
    });
  }
  
  // Look for any date-like patterns
  if (!extractedData.date) {
    const dateMatches = ocrText.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g);
    if (dateMatches) {
      extractedData.date = dateMatches[0];
      console.log('Fallback extraction found date:', extractedData.date);
    }
  }
  
  console.log('OCR Extraction Results:', {
    merchantName: extractedData.merchantName,
    itemCount: extractedData.items.length,
    items: extractedData.items,
    total: extractedData.total,
    tax: extractedData.tax,
    date: extractedData.date,
    fallbackUsed: extractedData.items.length === 0 || extractedData.total === 0
  });
  
  return extractedData;
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