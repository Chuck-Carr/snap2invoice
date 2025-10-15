/**
 * Enhanced server-side OCR extraction
 * This mirrors the enhanced client-side extraction but works in Node.js environment
 */

export function extractReceiptDataServer(ocrText) {
  console.log('=== Enhanced Server OCR Extraction Started ===');
  console.log('Raw OCR text length:', ocrText.length);
  
  const lines = ocrText.split('\n').map(line => line.trim()).filter(line => line);
  console.log('Processing', lines.length, 'non-empty lines');
  
  const extractedData = {
    merchantName: '',
    items: [],
    subtotal: 0,
    total: 0,
    tax: 0,
    taxRate: 0,
    date: null,
    confidence: {
      merchantName: 0,
      total: 0,
      tax: 0,
      items: 0
    }
  };

  // === ENHANCED PATTERNS ===
  
  const totalPatterns = [
    // Match "TOTAL $248.67" format (Home Depot style)
    /\bTOTAL[\s:]*\$?([0-9,]+\.[0-9]{2})/i,
    /(?:^|\s)(total|grand\s*total|amount\s*due|final\s*total|balance\s*due)[\s:]*\$?([0-9,]+\.?[0-9]*)/i,
    /(?:^|\s)(t0tal|t0t4l|t07al|t074l|7otal|tota1|70tal)[\s:]*\$?([0-9,]+\.?[0-9]*)/i,
    /(?:^|\s)(tot|ttl|toial|tolal)[\s:]*\$?([0-9,]+\.?[0-9]*)/i,
    /(?:total|grand|amount|due)[\s:$]*([0-9,]+\.[0-9]{2})\s*$/i
  ];

  const subtotalPatterns = [
    // Match "SUBTOTAL 232.95" format (Home Depot style)
    /\bSUBTOTAL[\s:]*\$?([0-9,]+\.[0-9]{2})/i,
    /(?:^|\s)(subtotal|sub\s*total|sub-total)[\s:]*\$?([0-9,]+\.?[0-9]*)/i,
    /(?:^|\s)(sub|subtot)[\s:]*\$?([0-9,]+\.?[0-9]*)/i
  ];

  const taxPatterns = [
    // Match "SALES TAX 15.72" format (Home Depot style)
    /\b(?:SALES\s*TAX|TAX)[\s:]*\$?([0-9,]+\.[0-9]{2})/i,
    /(?:^|\s)(tax|sales\s*tax|hst|gst|pst|vat)[\s:]*\$?([0-9,]+\.?[0-9]*)/i,
    /(tax|hst|gst)\s*(?:@\s*)?([0-9.]+%?)[\s:]*\$?([0-9,]+\.?[0-9]*)/i,
    /(?:^|\s)(1ax|7ax|iax)[\s:]*\$?([0-9,]+\.?[0-9]*)/i,
    /(?:tax|hst|gst)[\s:$]*([0-9,]+\.[0-9]{2})\s*$/i
  ];

  const datePatterns = [
    /([0-1]?[0-9])[\/\-\.]([0-3]?[0-9])[\/\-\.]([0-9]{2,4})/,
    /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+([0-3]?[0-9]),?\s+(20[0-9]{2})/i,
    /(20[0-9]{2})[\/\-\.]([0-1]?[0-9])[\/\-\.]([0-3]?[0-9])/
  ];

  // === MERCHANT NAME EXTRACTION ===
  console.log('--- Extracting Merchant Name ---');
  
  for (let i = 0; i < Math.min(8, lines.length); i++) {
    const line = lines[i];
    
    if (isMetadataLine(line)) {
      console.log(`Line ${i}: "${line}" - skipped (metadata)`);
      continue;
    }
    
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
  let totalConfidence = 0;

  for (const line of lines) {
    for (const pattern of totalPatterns) {
      const match = line.match(pattern);
      if (match) {
        const amount = parseFloat((match[1] || match[2]).replace(/,/g, ''));
        if (amount > 0 && amount < 10000) {
          const confidence = calculateTotalConfidence(line, amount);
          if (confidence > totalConfidence) {
            extractedData.total = amount;
            totalConfidence = confidence;
            console.log(`\u2705 Total: $${amount} from "${line}" (confidence: ${confidence}%)`);
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
      if (match) {
        const amount = parseFloat((match[1] || match[2]).replace(/,/g, ''));
        if (amount > 0 && amount <= extractedData.total) {
          extractedData.subtotal = amount;
          console.log(`\u2705 Subtotal: $${amount} from "${line}"`);
          break;
        }
      }
    }
    if (extractedData.subtotal > 0) break;
  }

  // === TAX EXTRACTION ===
  console.log('--- Extracting Tax ---');
  let taxConfidence = 0;

  for (const line of lines) {
    for (const pattern of taxPatterns) {
      const match = line.match(pattern);
      if (match) {
        let taxAmount;
        if (match[3]) {
          taxAmount = parseFloat(match[3].replace(/,/g, ''));
        } else if (match[2]) {
          taxAmount = parseFloat(match[2].replace(/,/g, ''));
        } else {
          taxAmount = parseFloat(match[1].replace(/,/g, ''));
        }
        
        if (taxAmount > 0 && taxAmount < extractedData.total) {
          const confidence = calculateTaxConfidence(line, taxAmount, extractedData.total);
          if (confidence > taxConfidence) {
            extractedData.tax = taxAmount;
            taxConfidence = confidence;
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
  
  console.log('Processing items (stopping at line', Math.min(25, lines.length), ')');
  const items = extractItemsEnhanced(lines, extractedData.total, extractedData.tax);
  console.log('Server item extraction: Found', items.length, 'items');
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

  console.log('=== Server Extraction Results ===');
  console.log('Merchant:', extractedData.merchantName);
  console.log('Total:', extractedData.total);
  console.log('Subtotal:', extractedData.subtotal);
  console.log('Tax:', extractedData.tax);
  console.log('Tax Rate:', extractedData.taxRate ? extractedData.taxRate.toFixed(2) + '%' : 'N/A');
  console.log('Date:', extractedData.date);
  console.log('Items:', extractedData.items.length);
  console.log('Overall Confidence:', calculateOverallConfidence(extractedData));
  console.log('=== End Server Extraction ===');

  return extractedData;
}

// === HELPER FUNCTIONS ===

function isMetadataLine(line) {
  const metadataPatterns = [
    /^tel:?\s*\(?[0-9]{3}\)?[\s\-]?[0-9]{3}[\s\-]?[0-9]{4}/i,
    /^www\.|^http|\.com|\.ca|\.org/i,
    /^[0-9]+\s+[a-z]+\s+(st|ave|rd|blvd|dr|ln|street|avenue|road|boulevard|drive|lane)/i,
    /^(mon|tue|wed|thu|fri|sat|sun)/i,
    /^(hours|open|closed|manager|cashier)/i,
    /receipt\s*#|transaction\s*#|store\s*#/i,
  ];
  
  return metadataPatterns.some(pattern => pattern.test(line));
}

function cleanMerchantName(line) {
  return line
    .replace(/[|\[\]{}]/g, '')
    .replace(/[£€¢]/g, '$')
    .replace(/\s+/g, ' ')
    .replace(/^[^a-zA-Z]+/, '')
    .replace(/[^a-zA-Z0-9\s&'-]+$/, '')
    .trim();
}

function calculateMerchantConfidence(name) {
  let confidence = 50;
  
  if (/\b(inc|llc|ltd|corp|company|store|shop|market|restaurant|cafe|bar)\b/i.test(name)) {
    confidence += 20;
  }
  
  if (/[0-9]/.test(name)) confidence -= 10;
  if (name.length < 5) confidence -= 10;
  if (name.length > 30) confidence -= 10;
  
  return Math.max(0, Math.min(100, confidence));
}

function calculateTotalConfidence(line, amount) {
  let confidence = 40;
  
  if (/\btotal\b/i.test(line)) confidence += 30;
  if (/\bgrand\s*total\b/i.test(line)) confidence += 40;
  if (/\bamount\s*due\b/i.test(line)) confidence += 25;
  if (/\bbalance\s*due\b/i.test(line)) confidence += 25;
  
  if (amount >= 1 && amount <= 1000) confidence += 20;
  if (amount > 1000) confidence -= 10;
  
  if (line.includes('$')) confidence += 10;
  
  return Math.max(0, Math.min(100, confidence));
}

function calculateTaxConfidence(line, taxAmount, total) {
  let confidence = 40;
  
  if (/\btax\b/i.test(line)) confidence += 30;
  if (/\bsales\s*tax\b/i.test(line)) confidence += 35;
  if (/\b(hst|gst|pst|vat)\b/i.test(line)) confidence += 40;
  
  if (total > 0) {
    const taxRate = (taxAmount / (total - taxAmount)) * 100;
    if (taxRate >= 3 && taxRate <= 20) confidence += 20;
    if (taxRate >= 5 && taxRate <= 15) confidence += 10;
  }
  
  return Math.max(0, Math.min(100, confidence));
}

function extractItemsEnhanced(lines, total, tax) {
  console.log('🔍 ENHANCED SERVER ITEM EXTRACTION STARTED');
  console.log('Total:', total, 'Tax:', tax);
  console.log('Lines to process:', lines.length);
  
  const items = [];
  
  // VERY MINIMAL exclusions - only skip obvious non-items
  const excludePatterns = [
    /^\s*thank\s*you\b/i,                                         // Thank you messages
    /^\s*visit\s*again\b/i,                                       // Visit again messages  
    /^\s*https?:\/\//i,                                           // URLs
    /^\s*\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{4}\s*$/i,               // Phone numbers only
    /^\s*store\s*hours?\b/i,                                      // Store hours
  ];
  
  // UNIVERSAL money patterns - work with any receipt format
  const moneyPatterns = [
    /\$\s*([0-9,]+\.[0-9]{2})/g,         // $XX.XX
    /\b([0-9,]+\.[0-9]{2})\b/g,          // XX.XX with word boundaries  
    /\b([0-9]+\.[0-9]{2})\s/g,           // XX.XX followed by space
    /\s([0-9]+\.[0-9]{2})$/g,            // XX.XX at end of line
    /([0-9]+\.[0-9]{2})\s*[A-Z<]/g,      // Price followed by letters/symbols
    /([0-9]+\.[0-9]{2})\s*$/g,           // Price at absolute end
    /\$([0-9,]+)\s/g,                    // $XX (dollars only) with space
    /([0-9]+)\.([0-9]{2})\b/g,           // Handle spaces in decimal
  ];
  
  console.log('📄 PROCESSING SERVER LINES:');
  
  lines.forEach((line, index) => {
    if (index < 10) console.log(`${index}: "${line}"`);
    
    // Only skip totally obvious exclusions
    if (excludePatterns.some(pattern => pattern.test(line))) {
      console.log(`  ⚠️ EXCLUDED: "${line}"`);
      return;
    }
    
    // Try to find ANY price in this line
    for (const pattern of moneyPatterns) {
      const matches = [...line.matchAll(pattern)];
      
      if (matches.length > 0) {
        console.log(`  🔍 Found ${matches.length} prices in line ${index}`);
        
        matches.forEach((match, matchIndex) => {
          let amount = parseFloat(match[1].replace(/,/g, ''));
          
          // Skip clearly invalid amounts
          if (amount <= 0 || amount > 9999) {
            console.log(`    ❌ Amount out of range: $${amount}`);
            return;
          }
          
          // Skip amounts that look like dates, phone numbers, codes, etc.
          if (amount < 1.00 && !line.toLowerCase().includes('tax')) {
            console.log(`    ❌ Amount too small (likely not a product): $${amount}`);
            return;
          }
          
          // Skip amounts that look like years, codes, etc.
          if (amount >= 1000 && amount <= 9999 && Math.floor(amount) === amount) {
            console.log(`    ❌ Amount looks like year/code: $${amount}`);
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
          
          console.log(`    💰 Processing: $${amount}`);
          
          // Smart description extraction for multiple prices
          let description = line;
          
          if (matches.length > 1) {
            // Multiple prices - extract context around THIS specific price
            const priceMatch = match[0];
            const priceIndex = line.indexOf(priceMatch);
            const contextStart = Math.max(0, priceIndex - 60);
            const contextBefore = line.substring(contextStart, priceIndex).trim();
            const parts = contextBefore.split(/\d{12,}|<[A-Z]>|\s{3,}/);
            const relevantPart = parts[parts.length - 1]?.trim();
            
            if (relevantPart && relevantPart.length > 3) {
              description = relevantPart;
              console.log(`    🎯 Context description: "${description}"`);
            } else {
              description = `Item ${matchIndex + 1} from line ${index}`;
              console.log(`    🔄 Generated description: "${description}"`);
            }
          } else {
            // Single price - remove the price from the line
            description = line.replace(match[0], '').trim();
          }
          
          // Clean up description
          description = description
            .replace(/^[\d\s\-.*#@x<>A]+/, '') 
            .replace(/[\d\s\-.*#<>A]+$/, '')
            .replace(/\s+/g, ' ')
            .replace(/SUBTOTAL.*$/i, '')
            .trim();
          
          if (!description || description.length < 2) {
            description = `Item ${index}-${matchIndex}`;
          }
          
          console.log(`    🏷️ Final description: "${description}"`);
          
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
            console.log(`  ✅ SERVER ADDED: "${description}" - $${amount}`);
          } else {
            console.log(`  🔁 Duplicate skipped`);
          }
        });
      }
    }
  });
  
  console.log(`🏁 SERVER EXTRACTION: ${items.length} items found`);
  
  // VALIDATION: Check if items add up to reasonable total
  const itemsTotal = items.reduce((sum, item) => sum + item.amount, 0);
  const expectedTotal = total - (tax || 0); // Subtotal
  
  console.log(`💰 Items total: $${itemsTotal.toFixed(2)}`);
  console.log(`💰 Expected total: $${expectedTotal.toFixed(2)}`);
  console.log(`💰 Receipt total: $${total}`);
  
  // If items total is way off, filter to most reasonable items
  if (Math.abs(itemsTotal - expectedTotal) > Math.max(expectedTotal * 0.1, 10)) {
    console.log(`⚠️ Items total doesn't match - filtering to reasonable items`);
    
    // Sort items by amount (largest first) and try combinations
    const sortedItems = [...items].sort((a, b) => b.amount - a.amount);
    let bestItems = [];
    let bestDifference = Infinity;
    
    // Try different combinations to find the best match
    for (let i = 1; i <= Math.min(sortedItems.length, 6); i++) {
      const combination = sortedItems.slice(0, i);
      const combinationTotal = combination.reduce((sum, item) => sum + item.amount, 0);
      const difference = Math.abs(combinationTotal - expectedTotal);
      
      console.log(`🧮 Testing ${i} items: $${combinationTotal.toFixed(2)} (diff: $${difference.toFixed(2)})`);
      
      if (difference < bestDifference && difference <= expectedTotal * 0.05) {
        bestItems = combination;
        bestDifference = difference;
        console.log(`✅ Better match found with ${i} items`);
      }
    }
    
    if (bestItems.length > 0) {
      console.log(`🎯 Using ${bestItems.length} validated items`);
      return bestItems;
    } else {
      console.log(`😞 No good combination found - falling back to generic item`);
      return [{
        description: 'Products/Services',
        amount: expectedTotal,
        quantity: 1
      }];
    }
  }
  
  return items;
}

function fallbackTotalExtraction(ocrText) {
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
    allNumbers.sort((a, b) => b - a);
    return allNumbers[0];
  }
  
  return 0;
}

function cleanItemDescriptionServer(description) {
  if (!description) return '';
  
  let cleaned = description
    .replace(/^[\d\s\-.*#@x]+/i, '')      // Remove leading numbers, symbols
    .replace(/[\d\s\-.*#]+$/, '')        // Remove trailing numbers, symbols
    .replace(/\b(qty|ea|each|@|x)\b/gi, '') // Remove quantity indicators
    .replace(/\s+/g, ' ')                 // Normalize spaces
    .trim();
  
  // Remove OCR artifacts
  cleaned = cleaned
    .replace(/^[|\[\]{}]+/, '')          // Remove brackets
    .replace(/[|\[\]{}]+$/, '')          // Remove brackets
    .replace(/^[-=_]+/, '')              // Remove dashes/lines
    .replace(/[-=_]+$/, '')              // Remove dashes/lines
    .trim();
  
  return cleaned;
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
