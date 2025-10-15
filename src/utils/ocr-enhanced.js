// Enhanced OCR extraction with better receipt parsing
// This file improves upon the original ocr.js with more accurate data extraction

/**
 * Enhanced receipt data extraction with better pattern matching
 */
export function extractReceiptDataEnhanced(ocrText) {
  console.log('=== Enhanced OCR Extraction Started ===');
  console.log('Raw OCR text length:', ocrText.length);
  
  // Smart line splitting - handle both multi-line and single-line OCR text
  let lines = ocrText.split('\n').map(line => line.trim()).filter(line => line);
  
  // If we only got one giant line, try to split it intelligently
  if (lines.length === 1 && lines[0].length > 100) {
    console.log('🚨 SINGLE LINE DETECTED - Attempting smart splitting');
    const singleLine = lines[0];
    
    // Split on common receipt patterns
    const splitPatterns = [
      // Home Depot specific patterns
      /\s+(?=\d{12}\s+[A-Z])/,      // Before 12-digit product codes + product name
      /(?<=\d{2}\.\d{2})\s+(?=[A-Z0-9]{3,})/,  // After price, before next product code
      /\s+(?=M12\s)/,              // Before M12 (Milwaukee tools)
      /\s+(?=HUSKY\s)/,            // Before HUSKY brand
      
      // General patterns
      /\s+(?=\d{12,}\s)/,           // Before long product codes
      /\s+(?=[A-Z][A-Z\s]{10,})/,   // Before long uppercase text (product names)
      /\s+(?=SUBTOTAL)/i,          // Before SUBTOTAL
      /\s+(?=SALES\s*TAX)/i,       // Before SALES TAX  
      /\s+(?=TOTAL)/i,             // Before TOTAL
      /\s+(?=\$\d+\.\d{2}\s+[A-Z])/,  // Before price followed by text
      /\s+(?=\d+\.\d{2}\s+[A-Z])/,   // Before decimal price followed by text
      /(?<=<A>\s\d+\.\d{2})\s+/,    // After <A> price pattern (Home Depot)
    ];
    
    // Try each pattern to split the line
    for (const pattern of splitPatterns) {
      const testSplit = singleLine.split(pattern);
      if (testSplit.length > lines.length) {
        lines = testSplit.map(line => line.trim()).filter(line => line);
        console.log(`✅ Split using pattern, got ${lines.length} lines`);
        break;
      }
    }
    
    // Universal receipt parsing - try multiple strategies
    if (lines.length === 1) {
      console.log('🌍 Trying UNIVERSAL receipt parsing');
      
      // Strategy 1: Split on price patterns (most common)
      let bestSplit = lines;
      let splitCount = 1;
      
      // Try different price-based splitting patterns
      const universalSplitPatterns = [
        // Pattern 1: Split before prices that are followed by more text
        /\s+(?=\d+\.\d{2}\s+\w)/,
        // Pattern 2: Split after prices that are followed by product codes or names  
        /(?<=\d\.\d{2})\s+(?=[A-Z0-9]{3,})/,
        // Pattern 3: Split before dollar amounts
        /\s+(?=\$\d+\.\d{2}\s)/,
        // Pattern 4: Split on multiple spaces between price and next item
        /(?<=\d\.\d{2})\s{3,}(?=\w)/,
        // Pattern 5: Split on product codes (UPC patterns)
        /\s+(?=\d{8,}\s+[A-Z])/,
        // Pattern 6: Split when we see repeating price-text patterns
        /(?<=\d\.\d{2})\s+(?=\w+.*?\d\.\d{2})/,
      ];
      
      for (const pattern of universalSplitPatterns) {
        try {
          const testSplit = singleLine.split(pattern).map(line => line.trim()).filter(line => line);
          if (testSplit.length > splitCount) {
            bestSplit = testSplit;
            splitCount = testSplit.length;
            console.log(`✅ Found better split: ${splitCount} lines`);
          }
        } catch (e) {
          // Skip patterns that cause errors
          console.log(`⚠️ Pattern failed, trying next`);
        }
      }
      
      // Strategy 2: If still one line, force split on any price occurrence
      if (bestSplit.length === 1) {
        console.log('🔪 FORCE SPLITTING on any price pattern');
        
        // Find all prices in the text and their positions
        const priceMatches = [];
        const priceRegex = /\b\d+\.\d{2}\b|\$\d+\.\d{2}/g;
        let match;
        
        while ((match = priceRegex.exec(singleLine)) !== null) {
          priceMatches.push({
            price: match[0],
            index: match.index,
            endIndex: match.index + match[0].length
          });
        }
        
        console.log(`Found ${priceMatches.length} prices in text`);
        
        if (priceMatches.length > 2) {
          // Split the text at each price location
          const segments = [];
          let lastEnd = 0;
          
          priceMatches.forEach((priceMatch, i) => {
            // Add text before this price (if any)
            if (priceMatch.index > lastEnd) {
              const beforeText = singleLine.substring(lastEnd, priceMatch.index).trim();
              if (beforeText) segments.push(beforeText);
            }
            
            // Find text after this price until next price (or end)
            const nextPriceStart = i < priceMatches.length - 1 ? priceMatches[i + 1].index : singleLine.length;
            const segment = singleLine.substring(priceMatch.index, nextPriceStart).trim();
            
            if (segment) segments.push(segment);
            lastEnd = nextPriceStart;
          });
          
          if (segments.length > bestSplit.length) {
            bestSplit = segments;
            console.log(`✅ Force split created ${segments.length} segments`);
          }
        }
      }
      
      lines = bestSplit;
    }
  }
  
  console.log('Processing', lines.length, 'lines after smart splitting');
  
  const extractedData = {
    merchantName: '',
    items: [],
    subtotal: 0,
    total: 0,
    tax: 0,
    taxRate: 0,
    date: null,
    address: '',
    confidence: {
      merchantName: 0,
      total: 0,
      tax: 0,
      items: 0
    }
  };

  // === ENHANCED PATTERNS ===
  
  // More comprehensive total patterns
  const totalPatterns = [
    // Standard patterns
    /(?:^|\s)(total|grand\s*total|amount\s*due|final\s*total|balance\s*due)[\s:]*\$?([0-9,]+\.?[0-9]*)/i,
    // OCR misreads of "TOTAL"
    /(?:^|\s)(t0tal|t0t4l|t07al|t074l|7otal|tota1|70tal)[\s:]*\$?([0-9,]+\.?[0-9]*)/i,
    // More flexible patterns
    /(?:^|\s)(tot|ttl|toial|tolal)[\s:]*\$?([0-9,]+\.?[0-9]*)/i,
    // End of line patterns
    /(?:total|grand|amount|due)[\s:$]*([0-9,]+\.[0-9]{2})\s*$/i
  ];

  // Enhanced subtotal patterns
  const subtotalPatterns = [
    /(?:^|\s)(subtotal|sub\s*total|sub-total)[\s:]*\$?([0-9,]+\.?[0-9]*)/i,
    /(?:^|\s)(sub|subtot)[\s:]*\$?([0-9,]+\.?[0-9]*)/i
  ];

  // Comprehensive tax patterns
  const taxPatterns = [
    // Standard tax patterns
    /(?:^|\s)(tax|sales\s*tax|hst|gst|pst|vat)[\s:]*\$?([0-9,]+\.?[0-9]*)/i,
    // Tax with rates
    /(tax|hst|gst)\s*(?:@\s*)?([0-9.]+%?)[\s:]*\$?([0-9,]+\.?[0-9]*)/i,
    // Tax misreads
    /(?:^|\s)(1ax|7ax|iax)[\s:]*\$?([0-9,]+\.?[0-9]*)/i,
    // End of line tax
    /(?:tax|hst|gst)[\s:$]*([0-9,]+\.[0-9]{2})\s*$/i
  ];

  // Date patterns (more comprehensive)
  const datePatterns = [
    // MM/DD/YYYY or DD/MM/YYYY
    /([0-1]?[0-9])[\/\-\.]([0-3]?[0-9])[\/\-\.](20[0-9]{2}|[0-9]{2})/,
    // Month DD, YYYY
    /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+([0-3]?[0-9]),?\s+(20[0-9]{2})/i,
    // YYYY-MM-DD
    /(20[0-9]{2})[\/\-\.]([0-1]?[0-9])[\/\-\.]([0-3]?[0-9])/
  ];

  // Money patterns (various formats)
  const moneyPatterns = [
    /\$\s*([0-9,]+\.[0-9]{2})/g,           // $XX.XX
    /([0-9,]+\.[0-9]{2})\s*$/g,            // XX.XX at end of line
    /\$\s*([0-9,]+)\s*$/g,                 // $XX at end of line
    /([0-9]{1,3}(?:,[0-9]{3})*\.[0-9]{2})/g, // Comma-separated numbers
  ];

  // === MERCHANT NAME EXTRACTION ===
  console.log('--- Extracting Merchant Name ---');
  
  for (let i = 0; i < Math.min(8, lines.length); i++) {
    const line = lines[i];
    
    // Skip if line looks like metadata
    if (isMetadataLine(line)) {
      console.log(`Line ${i}: "${line}" - skipped (metadata)`);
      continue;
    }
    
    // Clean the line
    const cleanName = cleanMerchantName(line);
    
    if (cleanName && cleanName.length >= 3 && cleanName.length <= 40) {
      extractedData.merchantName = cleanName;
      extractedData.confidence.merchantName = calculateMerchantConfidence(cleanName);
      console.log(`✅ Merchant name: "${cleanName}" (confidence: ${extractedData.confidence.merchantName}%)`);
      break;
    }
  }

  // === TOTAL EXTRACTION ===
  console.log('--- Extracting Total ---');
  let totalFound = false;
  let totalConfidence = 0;

  for (const line of lines) {
    for (const pattern of totalPatterns) {
      const match = line.match(pattern);
      if (match && match[2]) {
        const amount = parseFloat(match[2].replace(/,/g, ''));
        if (amount > 0 && amount < 10000) { // Reasonable range
          const confidence = calculateTotalConfidence(line, amount);
          if (confidence > totalConfidence) {
            extractedData.total = amount;
            totalConfidence = confidence;
            totalFound = true;
            console.log(`✅ Total: $${amount} from "${line}" (confidence: ${confidence}%)`);
          }
        }
      }
    }
  }

  extractedData.confidence.total = totalConfidence;

  // === SUBTOTAL EXTRACTION ===
  console.log('--- Extracting Subtotal ---');
  
  for (const line of lines) {
    for (const pattern of subtotalPatterns) {
      const match = line.match(pattern);
      if (match && match[2]) {
        const amount = parseFloat(match[2].replace(/,/g, ''));
        if (amount > 0 && amount <= extractedData.total) {
          extractedData.subtotal = amount;
          console.log(`✅ Subtotal: $${amount} from "${line}"`);
          break;
        }
      }
    }
    if (extractedData.subtotal > 0) break;
  }

  // === TAX EXTRACTION ===
  console.log('--- Extracting Tax ---');
  let taxFound = false;
  let taxConfidence = 0;

  for (const line of lines) {
    for (const pattern of taxPatterns) {
      const match = line.match(pattern);
      if (match) {
        // Handle different match groups based on pattern
        let taxAmount;
        if (match[3]) {
          // Pattern with rate and amount
          taxAmount = parseFloat(match[3].replace(/,/g, ''));
        } else if (match[2]) {
          // Pattern with just amount
          taxAmount = parseFloat(match[2].replace(/,/g, ''));
        } else {
          continue; // Skip if no valid amount found
        }
        
        if (taxAmount > 0 && taxAmount < extractedData.total) {
          const confidence = calculateTaxConfidence(line, taxAmount, extractedData.total);
          if (confidence > taxConfidence) {
            extractedData.tax = taxAmount;
            taxConfidence = confidence;
            taxFound = true;
            console.log(`✅ Tax: $${taxAmount} from "${line}" (confidence: ${confidence}%)`);
          }
        }
      }
    }
  }

  extractedData.confidence.tax = taxConfidence;

  // === CALCULATE SUBTOTAL FROM TOTAL AND TAX ===
  if (extractedData.total > 0 && extractedData.tax > 0 && extractedData.subtotal === 0) {
    extractedData.subtotal = extractedData.total - extractedData.tax;
    console.log(`📊 Calculated subtotal: $${extractedData.subtotal} (total - tax)`);
  }

  // === CALCULATE TAX RATE ===
  if (extractedData.tax > 0 && extractedData.subtotal > 0) {
    extractedData.taxRate = (extractedData.tax / extractedData.subtotal) * 100;
    console.log(`📊 Calculated tax rate: ${extractedData.taxRate.toFixed(2)}%`);
  }

  // === DATE EXTRACTION ===
  console.log('--- Extracting Date ---');
  
  for (const line of lines) {
    for (const pattern of datePatterns) {
      const match = line.match(pattern);
      if (match) {
        extractedData.date = match[0];
        console.log(`✅ Date: "${extractedData.date}" from "${line}"`);
        break;
      }
    }
    if (extractedData.date) break;
  }

  // === ITEM EXTRACTION ===
  console.log('--- Extracting Items ---');
  
  const items = extractItemsEnhanced(lines, extractedData.total, extractedData.tax);
  extractedData.items = items;
  extractedData.confidence.items = items.length > 0 ? 70 : 10;

  // === FALLBACK EXTRACTION ===
  if (extractedData.total === 0) {
    console.log('--- Fallback Total Extraction ---');
    extractedData.total = fallbackTotalExtraction(ocrText);
    if (extractedData.total > 0) {
      console.log(`🔄 Fallback total: $${extractedData.total}`);
      extractedData.confidence.total = 30;
    }
  }

  // === FINAL VALIDATION ===
  const isValid = validateExtractedData(extractedData);
  
  console.log('=== Extraction Results ===');
  console.log('Merchant:', extractedData.merchantName);
  console.log('Total:', extractedData.total);
  console.log('Subtotal:', extractedData.subtotal);
  console.log('Tax:', extractedData.tax);
  console.log('Tax Rate:', extractedData.taxRate ? extractedData.taxRate.toFixed(2) + '%' : 'N/A');
  console.log('Date:', extractedData.date);
  console.log('Items:', extractedData.items.length);
  console.log('Valid:', isValid);
  console.log('Overall Confidence:', calculateOverallConfidence(extractedData));
  console.log('=== End Extraction ===');

  return extractedData;
}

// === HELPER FUNCTIONS ===

function isMetadataLine(line) {
  const metadataPatterns = [
    /^tel:?\s*\(?[0-9]{3}\)?[\s\-]?[0-9]{3}[\s\-]?[0-9]{4}/i, // Phone numbers
    /^www\.|^http|\.com|\.ca|\.org/i,                          // URLs
    /^[0-9]+\s+[a-z]+\s+(st|ave|rd|blvd|dr|ln|street|avenue|road|boulevard|drive|lane)/i, // Addresses
    /^(mon|tue|wed|thu|fri|sat|sun)/i,                         // Days of week
    /^(hours|open|closed|manager|cashier)/i,                   // Store info
    /receipt\s*#|transaction\s*#|store\s*#/i,                 // Receipt metadata
  ];
  
  return metadataPatterns.some(pattern => pattern.test(line));
}

function cleanMerchantName(line) {
  return line
    .replace(/[|\[\]{}]/g, '')           // Remove brackets and pipes
    .replace(/[£€¢]/g, '$')              // Convert currency symbols
    .replace(/\s+/g, ' ')                // Normalize spaces
    .replace(/^[^a-zA-Z]+/, '')          // Remove leading non-letters
    .replace(/[^a-zA-Z0-9\s&'-]+$/, '')  // Remove trailing special chars
    .trim();
}

function calculateMerchantConfidence(name) {
  let confidence = 50;
  
  // Increase confidence for common business indicators
  if (/\b(inc|llc|ltd|corp|company|store|shop|market|restaurant|cafe|bar)\b/i.test(name)) {
    confidence += 20;
  }
  
  // Decrease confidence for common OCR artifacts
  if (/[0-9]/.test(name)) confidence -= 10;
  if (name.length < 5) confidence -= 10;
  if (name.length > 30) confidence -= 10;
  
  return Math.max(0, Math.min(100, confidence));
}

function calculateTotalConfidence(line, amount) {
  let confidence = 40;
  
  // Higher confidence for explicit "total" mentions
  if (/\btotal\b/i.test(line)) confidence += 30;
  if (/\bgrand\s*total\b/i.test(line)) confidence += 40;
  if (/\bamount\s*due\b/i.test(line)) confidence += 25;
  if (/\bbalance\s*due\b/i.test(line)) confidence += 25;
  
  // Higher confidence for reasonable amounts
  if (amount >= 1 && amount <= 1000) confidence += 20;
  if (amount > 1000) confidence -= 10;
  
  // Higher confidence for dollar sign
  if (line.includes('$')) confidence += 10;
  
  return Math.max(0, Math.min(100, confidence));
}

function calculateTaxConfidence(line, taxAmount, total) {
  let confidence = 40;
  
  // Higher confidence for explicit tax mentions
  if (/\btax\b/i.test(line)) confidence += 30;
  if (/\bsales\s*tax\b/i.test(line)) confidence += 35;
  if (/\b(hst|gst|pst|vat)\b/i.test(line)) confidence += 40;
  
  // Reasonable tax percentage (5-15%)
  if (total > 0) {
    const taxRate = (taxAmount / (total - taxAmount)) * 100;
    if (taxRate >= 3 && taxRate <= 20) confidence += 20;
    if (taxRate >= 5 && taxRate <= 15) confidence += 10; // Most common range
  }
  
  return Math.max(0, Math.min(100, confidence));
}

function extractItemsEnhanced(lines, total, tax) {
  console.log('🔍 AGGRESSIVE ITEM EXTRACTION STARTED');
  console.log('Total:', total, 'Tax:', tax);
  console.log('Lines to process:', lines.length);
  
  const items = [];
  
  // VERY MINIMAL exclusions - only skip obvious non-items
  const excludePatterns = [
    // Only exclude lines that START with these words AND have no product context
    /^\s*thank\s*you\b/i,                                         // Thank you messages
    /^\s*visit\s*again\b/i,                                       // Visit again messages  
    /^\s*https?:\/\//i,                                           // URLs
    /^\s*\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{4}\s*$/i,               // Phone numbers only
    /^\s*store\s*hours?\b/i,                                      // Store hours
  ];
  
  // UNIVERSAL money patterns - work with any receipt format
  const moneyPatterns = [
    // Standard formats
    /\$\s*([0-9,]+\.[0-9]{2})/g,         // $XX.XX
    /\b([0-9,]+\.[0-9]{2})\b/g,          // XX.XX with word boundaries  
    /\b([0-9]+\.[0-9]{2})\s/g,           // XX.XX followed by space
    /\s([0-9]+\.[0-9]{2})$/g,            // XX.XX at end of line
    
    // Special receipt formats
    /([0-9]+\.[0-9]{2})\s*[A-Z<]/g,      // Price followed by letters/symbols
    /([0-9]+\.[0-9]{2})\s*$/g,           // Price at absolute end
    /\$([0-9,]+)\s/g,                    // $XX (dollars only) with space
    
    // Handle OCR artifacts
    /([0-9]+)\.([0-9]{2})\b/g,           // Handle spaces in decimal
  ];
  
  console.log('🎯 Using aggressive money patterns');
  
  // Log every line for debugging
  console.log('📄 ALL LINES:');
  lines.forEach((line, index) => {
    console.log(`${index}: "${line}"`);
  });
  
  // SUPER AGGRESSIVE: Process ALL lines, minimal filtering
  console.log('🚀 PROCESSING ALL LINES AGGRESSIVELY');
  
  lines.forEach((line, index) => {
    console.log(`\nProcessing Line ${index}: "${line}"`);
    
    // Only skip totally obvious exclusions
    if (excludePatterns.some(pattern => pattern.test(line))) {
      console.log(`  ⚠️ EXCLUDED by pattern`);
      return;
    }
    
    // Try to find ANY price in this line
    let foundPrice = false;
    
    for (const pattern of moneyPatterns) {
      const matches = [...line.matchAll(pattern)];
      
      if (matches.length > 0) {
        console.log(`  🔍 Found ${matches.length} price matches:`, matches.map(m => m[0]));
        
        matches.forEach((match, matchIndex) => {
          let amount = parseFloat(match[1].replace(/,/g, ''));
          
          // Handle edge case where we might have captured dollars without cents
          if (match[0].includes('$') && !match[0].includes('.')) {
            console.log(`  💵 Dollar-only amount detected: $${amount}`);
          }
          
          console.log(`  💰 Processing amount: $${amount}`);
          
          // Only skip if amount is clearly wrong
          if (amount <= 0 || amount > 9999) {
            console.log(`    ❌ Amount out of range: $${amount}`);
            return;
          }
          
          // Be very lenient with total/tax matching
          if (Math.abs(amount - total) < 0.01) {
            console.log(`    ❌ Amount matches total: $${amount}`);
            return;
          }
          if (tax > 0 && Math.abs(amount - tax) < 0.01) {
            console.log(`    ❌ Amount matches tax: $${amount}`);
            return;
          }
          
          // NEW: Smart description extraction for multiple prices in one line
          let description = line;
          
          if (matches.length > 1) {
            // Multiple prices - extract context around THIS specific price
            const priceMatch = match[0];
            const priceIndex = line.indexOf(priceMatch);
            
            // Get text before this price (up to 60 chars)
            const contextStart = Math.max(0, priceIndex - 60);
            const contextBefore = line.substring(contextStart, priceIndex).trim();
            
            // Look for product description before this price
            // Split by common separators and take the last meaningful part
            const parts = contextBefore.split(/\d{12,}|<[A-Z]>|\s{3,}/);
            const relevantPart = parts[parts.length - 1]?.trim();
            
            if (relevantPart && relevantPart.length > 3) {
              description = relevantPart;
              console.log(`  🎯 Context-based description for $${amount}: "${description}"`);
            } else {
              // Fallback: use position-based extraction
              description = `Item ${matchIndex + 1} from line ${index}`;
              console.log(`  🔄 Position-based description: "${description}"`);
            }
          } else {
            // Single price - remove the price from the line
            description = line.replace(match[0], '').trim();
          }
          
          // Clean up description minimally
          description = description
            .replace(/^[\d\s\-.*#@x<>A]+/, '') // Remove leading junk including <A>
            .replace(/[\d\s\-.*#<>A]+$/, '')  // Remove trailing junk including <A>
            .replace(/\s+/g, ' ')             // Normalize spaces
            .replace(/SUBTOTAL.*$/i, '')      // Remove anything after SUBTOTAL
            .trim();
          
          console.log(`  🏷️ Final description: "${description}"`);
          
          // Accept almost any description
          if (!description || description.length < 2) {
            description = `Item ${index}-${matchIndex}`;
            console.log(`  🔄 Generated description: "${description}"`);
          }
          
          // Check for duplicates
          const isDuplicate = items.some(item => 
            Math.abs(item.amount - amount) < 0.01 && 
            item.description.toLowerCase() === description.toLowerCase()
          );
          
          if (!isDuplicate) {
            items.push({
              description: description,
              amount: amount,
              quantity: 1
            });
            console.log(`  ✅ ADDED ITEM: "${description}" - $${amount}`);
            foundPrice = true;
          } else {
            console.log(`  🔁 Duplicate item skipped`);
          }
        });
      }
    }
    
    if (!foundPrice) {
      console.log(`  ❌ No prices found in line`);
    }
  });
  
  console.log(`\n📊 EXTRACTION SUMMARY`);
  console.log(`Found ${items.length} individual items:`);
  items.forEach((item, index) => {
    console.log(`  ${index + 1}. "${item.description}" - $${item.amount}`);
  });
  
  // EMERGENCY MANUAL PARSING - If still no items, try manual extraction
  if (items.length === 0 && ocrText.length > 100) {
    console.log(`🆘 EMERGENCY MANUAL PARSING`);
    
    // Look for clear price patterns in the text
    const manualMatches = [];
    
    // Find all instances of prices with context
    const priceContextPattern = /([A-Z][A-Z\s\d\/\-\.]{5,50})\s*([<A>\s]*)\s*(\d{1,4}\.\d{2})/gi;
    let match;
    
    while ((match = priceContextPattern.exec(ocrText)) !== null) {
      const description = match[1].trim().replace(/[<>A]/g, '').trim();
      const price = parseFloat(match[3]);
      
      // Skip obvious totals and taxes
      if (price < total && price > 0.50 && 
          !description.toLowerCase().includes('total') &&
          !description.toLowerCase().includes('tax')) {
        
        manualMatches.push({
          description: description,
          amount: price,
          quantity: 1
        });
        
        console.log(`🔧 Manual match: "${description}" - $${price}`);
      }
    }
    
    if (manualMatches.length > 0) {
      items.push(...manualMatches);
      console.log(`✅ Manual parsing found ${manualMatches.length} items!`);
    } else {
      // Last resort - create generic item
      console.log(`😨 NO ITEMS FOUND - Creating generic fallback`);
      const itemAmount = total - tax;
      if (itemAmount > 0) {
        items.push({
          description: 'Products/Services',
          amount: itemAmount,
          quantity: 1
        });
        console.log(`🔄 Generic item: "Products/Services" - $${itemAmount}`);
      }
    }
  }
  
  console.log(`🏁 FINAL RESULT: ${items.length} items extracted`);
  return items;
}

function fallbackTotalExtraction(ocrText) {
  // Look for any number that could be a total
  const allNumbers = [];
  const patterns = [
    /\$([0-9,]+\.[0-9]{2})/g,
    /\b([0-9,]+\.[0-9]{2})\b/g
  ];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(ocrText)) !== null) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      if (amount > 0 && amount < 10000) {
        allNumbers.push(amount);
      }
    }
  });
  
  if (allNumbers.length > 0) {
    // Return the largest reasonable number
    allNumbers.sort((a, b) => b - a);
    return allNumbers[0];
  }
  
  return 0;
}

function validateExtractedData(data) {
  // Basic validation checks
  const hasTotal = data.total > 0;
  const hasMerchant = data.merchantName.length > 0;
  const hasReasonableTotal = data.total > 0 && data.total < 10000;
  
  // Tax validation
  const taxValid = data.tax >= 0 && data.tax <= data.total;
  
  // Subtotal validation
  const subtotalValid = data.subtotal >= 0 && data.subtotal <= data.total;
  
  return hasTotal && hasReasonableTotal && taxValid && subtotalValid;
}

function calculateOverallConfidence(data) {
  const weights = {
    merchantName: 0.2,
    total: 0.4,
    tax: 0.2,
    items: 0.2
  };
  
  let weightedSum = 0;
  let totalWeight = 0;
  
  Object.keys(weights).forEach(key => {
    if (data.confidence[key] > 0) {
      weightedSum += data.confidence[key] * weights[key];
      totalWeight += weights[key];
    }
  });
  
  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}

// Helper functions for enhanced item extraction
function cleanItemDescription(description, originalLine = '') {
  if (!description) return '';
  
  let cleaned = description
    .replace(/^[\d\s\-.*#@x]+/i, '')      // Remove leading numbers, spaces, symbols
    .replace(/[\d\s\-.*#]+$/, '')        // Remove trailing numbers, symbols  
    .replace(/\b(qty|ea|each|@|x)\b/gi, '') // Remove quantity indicators
    .replace(/\s+/g, ' ')                 // Normalize spaces
    .trim();
  
  // Remove common OCR artifacts
  cleaned = cleaned
    .replace(/^[|\[\]{}]+/, '')          // Remove leading brackets
    .replace(/[|\[\]{}]+$/, '')          // Remove trailing brackets
    .replace(/^[-=_]+/, '')              // Remove leading dashes/lines
    .replace(/[-=_]+$/, '')              // Remove trailing dashes/lines
    .trim();
  
  return cleaned;
}

function hasMoneyAmount(line) {
  return /\$?[0-9,]+\.[0-9]{2}/.test(line);
}

function findMoneyAmount(line) {
  const match = line.match(/\$?([0-9,]+\.[0-9]{2})/);
  return match ? parseFloat(match[1].replace(/,/g, '')) : null;
}

function isExcludedAmount(line, amount, total, tax) {
  // Skip if amount matches total or tax
  if (Math.abs(amount - total) < 0.01 || Math.abs(amount - tax) < 0.01) return true;
  
  // Skip if line contains exclusion keywords
  const excludeWords = /\b(total|subtotal|tax|change|cash|credit|debit|payment|tender|balance)\b/i;
  if (excludeWords.test(line)) return true;
  
  // Skip unreasonable amounts
  if (amount < 0.01 || amount > total) return true;
  
  return false;
}

function isLikelyProductDescription(description) {
  if (!description || description.length < 3 || description.length > 100) return false;
  
  // Must contain letters
  if (!/[a-zA-Z]/.test(description)) return false;
  
  // Skip if it's all numbers or punctuation
  if (/^[\d\s\-.*#@]+$/.test(description)) return false;
  
  // Skip common non-product lines
  const nonProductPatterns = [
    /^(receipt|invoice|store|manager|cashier|clerk|employee|customer|phone|tel|www|http)/i,
    /^(thank|visit|return|policy|hours|open|closed)/i,
    /^(street|ave|road|blvd|dr|lane|st\b)/i,
    /\b(mon|tue|wed|thu|fri|sat|sun)\b/i,
    /^[0-9\s\-:/]+$/,  // Just numbers, spaces, and basic punctuation
  ];
  
  if (nonProductPatterns.some(pattern => pattern.test(description))) return false;
  
  // Looks like it could be a product
  return true;
}

// Export the enhanced extraction as a replacement for the original
export function extractReceiptData(ocrText) {
  return extractReceiptDataEnhanced(ocrText);
}
