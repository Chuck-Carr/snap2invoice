import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req) {
  try {
    // Get user from auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    // Create client with user's token
    const token = authHeader.replace('Bearer ', '');
    const userSupabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });

    // Get user
    const { data: { user }, error: authError } = await userSupabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const { receiptIds } = await req.json();

    if (!receiptIds || !Array.isArray(receiptIds) || receiptIds.length === 0) {
      return new Response(JSON.stringify({ error: 'Receipt IDs are required' }), { status: 400 });
    }

    // Check user's monthly limit
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('subscription_plan, invoices_this_month, month_year')
      .eq('id', user.id)
      .single();

    if (profileError) throw profileError;

    const currentMonth = new Date().toISOString().slice(0, 7);
    const isFreePlan = profile.subscription_plan === 'free';
    const hasExceededLimit = isFreePlan && profile.invoices_this_month >= 3 && profile.month_year === currentMonth;

    if (hasExceededLimit) {
      return new Response(JSON.stringify({ 
        error: 'Monthly limit reached. Please upgrade to premium for unlimited invoices.' 
      }), { status: 403 });
    }

    // Verify that all receipts belong to the user and are not already linked to an invoice
    const { data: receipts, error: receiptsError } = await supabase
      .from('receipts')
      .select('id, user_id, invoice_id, file_name, ocr_text, ocr_processed')
      .in('id', receiptIds)
      .eq('user_id', user.id);

    if (receiptsError) throw receiptsError;

    if (receipts.length !== receiptIds.length) {
      return new Response(JSON.stringify({ 
        error: 'Some receipts not found' 
      }), { status: 400 });
    }

    // Check if any receipts are already linked to invoices
    const alreadyLinkedReceipts = receipts.filter(receipt => receipt.invoice_id);

    if (alreadyLinkedReceipts.length > 0) {
      return new Response(JSON.stringify({ 
        error: `${alreadyLinkedReceipts.length} receipt(s) are already linked to other invoices` 
      }), { status: 400 });
    }

    // Process OCR data from all receipts to generate invoice items
    const allItems = [];
    let combinedSubtotal = 0;
    let combinedTaxAmount = 0;
    const processedReceiptNames = [];
    
    // Import OCR utility functions
    // Note: We'll implement server-side versions of these functions since the original
    // OCR utilities are designed for client-side use with Tesseract.js
    
    // Server-side OCR data extraction function
    function extractReceiptDataServer(ocrText) {
      const lines = ocrText.split('\n').map(line => line.trim()).filter(line => line);
      
      const extractedData = {
        merchantName: '',
        items: [],
        total: 0,
        tax: 0,
        date: null
      };

      // Enhanced patterns for extraction with more variations
      const totalPattern = /(?:total|amount|sum|balance|due|grand)[\s:$]*([\d,]+\.?\d*)/i;
      const totalPatternAlt = /(?:t0tal|t0t4l|t07al|t074l|t0741|to7al|to74l|70tal|7otal|tota1|t0ta1)[\s:$]*([\d,]+\.?\d*)/i;
      const taxPattern = /(?:tax|vat|sales\s*tax|hst|gst|pst)[\s:$]*([\d,]+\.?\d*)/i;
      const datePattern = /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/;
      const pricePattern = /\$?[\d,]+\.\d{2}/g;
      
      // Fallback patterns for when primary extraction fails
      const dollarAmountPattern = /\$[\d,]+\.\d{2}/g;
      
      const excludeFromItemsPattern = /(?:total|subtotal|sub\s*total|tax|vat|sales\s*tax|amount|sum|balance|due|change|cash|credit|debit|tender|usd\$|usb\$|u5d\$|u50\$|payment|paid|auth\s*code|card|visa|mastercard|discover|amex)/i;
      const paymentMethodPattern = /(?:usd\$|usb\$|u5d\$|u50\$|card\s*#|auth\s*code|approval|transaction|ref\s*#|batch|seq|terminal)/i;

      // Extract merchant name
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

      // Find total line index
      let totalLineIndex = -1;
      lines.forEach((line, index) => {
        if ((line.match(totalPattern) || line.match(totalPatternAlt)) && totalLineIndex === -1) {
          totalLineIndex = index;
        }
      });
      
      // Extract items
      lines.forEach((line, index) => {
        if (totalLineIndex >= 0 && index >= totalLineIndex) {
          return;
        }
        
        const prices = line.match(pricePattern);
        if (prices) {
          const isExcluded = line.match(excludeFromItemsPattern) || line.match(paymentMethodPattern);
          
          if (!isExcluded) {
            const lastPrice = prices[prices.length - 1];
            const description = line.replace(lastPrice, '').trim();
            
            if (description && 
                description.length > 2 && 
                !description.match(/^\d+$/) && 
                !description.match(/^[\s\-\.]+$/) && 
                description.length < 100) {
              
              extractedData.items.push({
                description: description,
                amount: parseFloat(lastPrice.replace('$', ''))
              });
            }
          }
        }
      });

      // If we didn't find much useful data, try more aggressive extraction
      if (extractedData.items.length === 0 && extractedData.total === 0) {
        console.log('Trying fallback extraction methods for server-side processing...');
        
        // Look for any dollar amounts in the text
        const allDollarAmounts = [];
        const dollarMatches = ocrText.match(dollarAmountPattern);
        if (dollarMatches) {
          dollarMatches.forEach(match => {
            const amount = parseFloat(match.replace(/[$,]/g, ''));
            if (amount > 0 && amount < 10000) { // Reasonable range
              allDollarAmounts.push(amount);
            }
          });
          
          // If we found dollar amounts, assume the highest one might be the total
          if (allDollarAmounts.length > 0) {
            allDollarAmounts.sort((a, b) => b - a);
            extractedData.total = allDollarAmounts[0];
            
            // Create a generic item with the total
            if (extractedData.items.length === 0) {
              extractedData.items.push({
                description: 'Services/Products',
                amount: extractedData.total
              });
            }
            
            console.log('Server fallback extraction found total:', extractedData.total);
          }
        }
        
        // Look for any date-like patterns
        if (!extractedData.date) {
          const dateMatches = ocrText.match(datePattern);
          if (dateMatches) {
            extractedData.date = dateMatches[0];
            console.log('Server fallback extraction found date:', extractedData.date);
          }
        }
      }
      
      return extractedData;
    }
    
    // Server-side invoice items generation
    function generateInvoiceItemsServer(extractedData) {
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
    
    for (const receipt of receipts) {
      if (receipt.ocr_processed && receipt.ocr_text) {
        try {
          console.log(`Processing OCR data for receipt: ${receipt.file_name}`);
          
          // Extract structured data from OCR text
          const extractedData = extractReceiptDataServer(receipt.ocr_text);
          const receiptItems = generateInvoiceItemsServer(extractedData);
          
          // Add receipt source to each item description
          const itemsWithSource = receiptItems.map((item, index) => ({
            id: `receipt-${receipt.id}-item-${index}`,
            description: `${item.description} (from ${receipt.file_name})`,
            quantity: item.quantity,
            rate: item.rate,
            amount: item.amount
          }));
          
          allItems.push(...itemsWithSource);
          combinedSubtotal += extractedData.items.reduce((sum, item) => sum + (item.amount || 0), 0);
          combinedTaxAmount += extractedData.tax || 0;
          processedReceiptNames.push(receipt.file_name);
          
          console.log(`Added ${receiptItems.length} items from ${receipt.file_name}`);
        } catch (ocrError) {
          console.error(`Failed to process OCR for ${receipt.file_name}:`, ocrError);
          // Continue with other receipts
        }
      } else {
        console.log(`No OCR data available for ${receipt.file_name}`);
      }
    }
    
    // If no items were extracted from any receipt, create placeholder items
    if (allItems.length === 0) {
      receipts.forEach((receipt, index) => {
        allItems.push({
          id: `placeholder-${index}`,
          description: `Services/Products from ${receipt.file_name}`,
          quantity: 1,
          rate: 0,
          amount: 0
        });
      });
    }
    
    const finalSubtotal = combinedSubtotal || allItems.reduce((sum, item) => sum + item.amount, 0);
    const finalTaxAmount = combinedTaxAmount;
    const finalTotal = finalSubtotal + finalTaxAmount;
    
    // Generate invoice number
    const invoiceNumber = `INV-${Date.now()}`;
    
    const notes = processedReceiptNames.length > 0 
      ? `Created from ${receipts.length} receipt(s). OCR processed: ${processedReceiptNames.join(', ')}. Other receipts: ${receipts.filter(r => !processedReceiptNames.includes(r.file_name)).map(r => r.file_name).join(', ')}`
      : `Created from ${receipts.length} receipt(s): ${receipts.map(r => r.file_name).join(', ')}. No OCR data available - please add items manually.`;

    // Create a new invoice
    const { data: invoiceData, error: invoiceError } = await supabase
      .from('invoices')
      .insert([{
        user_id: user.id,
        invoice_number: invoiceNumber,
        client_name: '', // User will need to fill this in
        issue_date: new Date().toISOString().split('T')[0],
        due_date: null,
        items: JSON.stringify(allItems),
        subtotal: finalSubtotal.toFixed(2),
        tax_amount: finalTaxAmount.toFixed(2),
        tax_rate: finalSubtotal > 0 ? ((finalTaxAmount / finalSubtotal) * 100).toFixed(2) : 0,
        total_amount: finalTotal.toFixed(2),
        status: 'draft',
        notes: notes
      }])
      .select()
      .single();

    if (invoiceError) throw invoiceError;

    // Link all receipts to the new invoice
    const { data: updatedReceipts, error: updateError } = await supabase
      .from('receipts')
      .update({ invoice_id: invoiceData.id })
      .in('id', receiptIds)
      .eq('user_id', user.id)
      .select();

    if (updateError) throw updateError;

    // Increment user's invoice count
    await supabase.rpc('increment_invoice_count', { user_uuid: user.id });

    return new Response(JSON.stringify({
      success: true,
      message: `Successfully created invoice from ${receipts.length} receipt(s)`,
      invoice: {
        id: invoiceData.id,
        invoiceNumber: invoiceData.invoice_number,
        receiptCount: updatedReceipts.length,
        itemCount: allItems.length,
        subtotal: finalSubtotal.toFixed(2),
        taxAmount: finalTaxAmount.toFixed(2),
        totalAmount: finalTotal.toFixed(2),
        ocrProcessedCount: processedReceiptNames.length
      },
      linkedReceipts: updatedReceipts,
      extractedItems: allItems.length
    }));

  } catch (err) {
    console.error('Create invoice from receipts error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}