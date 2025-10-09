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
    
    if (!imageFile.type.startsWith('image/')) {
      throw new Error(`Unsupported file type: ${imageFile.type}. Please use JPG, PNG, or WebP format.`);
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
    
    // Create image URL for Tesseract
    const imageUrl = URL.createObjectURL(imageFile);
    
    try {
      const result = await Tesseract.recognize(imageUrl, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          } else if (m.status) {
            console.log('OCR Status:', m.status);
          }
        }
      });
      
      // Clean up the object URL
      URL.revokeObjectURL(imageUrl);
      
      if (!result || !result.data || !result.data.text) {
        throw new Error('No text found in image');
      }
      
      console.log('OCR Success! Text length:', result.data.text.length);
      
      return {
        text: result.data.text.trim(),
        confidence: result.data.confidence,
        success: true
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

  // Enhanced patterns for extraction
  const totalPattern = /(?:total|amount|sum|balance|due)[\s:$]*(\d+\.?\d*)/i;
  // Alternative patterns for OCR misreads of TOTAL
  const totalPatternAlt = /(?:t0tal|t0t4l|t07al|t074l|t0741|to7al|to74l)[\s:$]*(\d+\.?\d*)/i;
  const subtotalPattern = /(?:subtotal|sub\s*total)[\s:$]*(\d+\.?\d*)/i;
  const taxPattern = /(?:tax|vat|sales\s*tax)[\s:$]*(\d+\.?\d*)/i;
  const datePattern = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/;
  const pricePattern = /\$?\d+\.\d{2}/g;
  
  // Patterns to exclude from item extraction
  const excludeFromItemsPattern = /(?:total|subtotal|sub\s*total|tax|vat|sales\s*tax|amount|sum|balance|due|change|cash|credit|debit|tender|usd\$|usb\$|u5d\$|u50\$|payment|paid|auth\s*code|card|visa|mastercard|discover|amex|home\s*depot|walmart|target|costco)/i;
  
  // Additional patterns for payment methods and receipt footers
  const paymentMethodPattern = /(?:usd\$|usb\$|u5d\$|u50\$|card\s*#|auth\s*code|approval|transaction|ref\s*#|batch|seq|terminal)/i;
  const receiptFooterPattern = /(?:thank\s*you|visit|return\s*policy|policy\s*id|days|expires|barcode|^\d{4}\s+\d{2}\/\d{2}\/\d{2})/i;

  // Extract merchant name (usually first non-address line)
  if (lines.length > 0) {
    extractedData.merchantName = lines[0];
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
  
  // Extract potential items (lines with prices, excluding totals/tax/subtotal lines)
  // Stop processing after TOTAL line to avoid payment method lines
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
        const description = line.replace(lastPrice, '').trim();
        
        console.log(`  - Potential item: "${description}" - ${lastPrice}`);
        
        // Additional filtering for item descriptions
        if (description && 
            description.length > 2 && 
            !description.match(/^\d+$/) && // Not just numbers
            !description.match(/^[\s\-\.]+$/) && // Not just spaces/dashes/dots
            !description.match(/^[x]+$/i) && // Not just X's (like card numbers)
            !description.toLowerCase().includes('change') &&
            !description.toLowerCase().includes('tender') &&
            !description.toLowerCase().includes('home depot') &&
            !description.toLowerCase().includes('usd') &&
            !description.toLowerCase().includes('auth') &&
            !description.toLowerCase().includes('code') &&
            description.length < 100) { // Reasonable item description length
          
          console.log(`  ✅ Adding item: "${description}" - $${parseFloat(lastPrice.replace('$', ''))}`);
          
          extractedData.items.push({
            description: description,
            amount: parseFloat(lastPrice.replace('$', ''))
          });
        } else {
          console.log(`  ❌ Filtered out: "${description}"`);
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

  console.log('OCR Extraction Results:', {
    merchantName: extractedData.merchantName,
    itemCount: extractedData.items.length,
    items: extractedData.items,
    total: extractedData.total,
    tax: extractedData.tax,
    date: extractedData.date
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