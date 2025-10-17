import { createClient } from '@supabase/supabase-js';
import { hasValidPremiumAccess, isWithinFreePlanLimits } from '@/lib/subscription';

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

    // Check user's subscription and monthly limit
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('subscription_plan, subscription_expires_at, subscription_cancelled_at, invoices_this_month, month_year')
      .eq('id', user.id)
      .single();

    if (profileError) throw profileError;

    const isPremium = hasValidPremiumAccess(profile);
    const withinLimits = isWithinFreePlanLimits(profile);

    if (!withinLimits) {
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
    
    // Import enhanced server-side extraction
    const { extractReceiptDataServer } = await import('@/lib/ocr-server');
    
    // Server-side invoice items generation (enhanced)
    function generateInvoiceItemsServer(extractedData) {
      const items = [];

      // Add extracted items
      extractedData.items.forEach((item, index) => {
        items.push({
          id: `item-${index}`,
          description: item.description,
          quantity: item.quantity || 1,
          rate: item.amount,
          amount: item.amount
        });
      });

      // If no items were extracted, create a general item with the subtotal
      if (items.length === 0 && extractedData.total > 0) {
        const itemAmount = extractedData.subtotal > 0 ? extractedData.subtotal : extractedData.total - (extractedData.tax || 0);
        items.push({
          id: 'item-0',
          description: `Services/Products from ${extractedData.merchantName || 'Merchant'}`,
          quantity: 1,
          rate: itemAmount,
          amount: itemAmount
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
          // Use subtotal from enhanced extraction if available
          combinedSubtotal += extractedData.subtotal || extractedData.items.reduce((sum, item) => sum + (item.amount || 0), 0);
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
    
    // Calculate tax rate if we have both subtotal and tax
    const taxRate = finalSubtotal > 0 && finalTaxAmount > 0 ? (finalTaxAmount / finalSubtotal) * 100 : 0;
    
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
        tax_rate: taxRate.toFixed(2),
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