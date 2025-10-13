import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import mime from 'mime';

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

    // Check user's monthly limit
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('subscription_plan, invoices_this_month, month_year')
      .eq('id', user.id)
      .single();

    if (profileError) throw profileError;

    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
    const isFreePlan = profile.subscription_plan === 'free';
    const hasExceededLimit = isFreePlan && profile.invoices_this_month >= 3 && profile.month_year === currentMonth;

    if (hasExceededLimit) {
      return new Response(JSON.stringify({ 
        error: 'Monthly limit reached. Please upgrade to premium for unlimited invoices.' 
      }), { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    const ocrText = formData.get('ocrText') || ''; // OCR text from client
    const ocrData = formData.get('ocrData'); // Parsed OCR data from client
    const invoiceId = formData.get('invoiceId'); // Optional invoice ID to add receipt to
    const createNewInvoice = formData.get('createNewInvoice') === 'true'; // Explicit flag to create new invoice
    const ocrProcessed = ocrText.length > 0; // Define if OCR was processed
    
    if (!file) throw new Error('No file uploaded');

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileExt = mime.getExtension(file.type);
    const fileName = `${user.id}/${uuidv4()}.${fileExt}`;
    const filePath = `receipts/${fileName}`;

    // Upload file to storage
    const { error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(filePath, buffer, { contentType: file.type });
    if (uploadError) throw uploadError;

    // Get public URL
    const { data: publicUrl } = supabase.storage
      .from('receipts')
      .getPublicUrl(filePath);

    // Insert receipt record
    const receiptData = { 
      user_id: user.id,
      file_name: file.name, 
      file_url: publicUrl.publicUrl,
      ocr_text: ocrText,
      ocr_processed: ocrProcessed
    };
    
    // If invoice ID is provided, verify it belongs to the user and add it to receipt data
    if (invoiceId) {
      const { data: existingInvoice, error: invoiceCheckError } = await supabase
        .from('invoices')
        .select('id')
        .eq('id', invoiceId)
        .eq('user_id', user.id)
        .single();
        
      if (!invoiceCheckError && existingInvoice) {
        receiptData.invoice_id = invoiceId;
      }
    }
    
    const { data: receipt, error: dbError } = await supabase
      .from('receipts')
      .insert([receiptData])
      .select()
      .single();
    
    if (dbError) throw dbError;

    // Invoice creation logic:
    // - Only create if explicitly requested via createNewInvoice=true
    // - Don't create if adding to existing invoice (invoiceId provided)
    // - Require OCR data to have something to populate the invoice with
    let invoice = null;
    if (ocrData && createNewInvoice && !invoiceId) {
      try {
        const extractedData = JSON.parse(ocrData);
        
        // Generate invoice number
        const invoiceNumber = `INV-${Date.now()}`;
        
        const subtotal = extractedData.items ? extractedData.items.reduce((sum, item) => sum + (item.amount || 0), 0) : 0;
        const taxAmount = extractedData.tax || 0;
        const total = subtotal + taxAmount;

        const { data: invoiceData, error: invoiceError } = await supabase
          .from('invoices')
          .insert([{
            user_id: user.id,
            receipt_id: receipt.id,
            invoice_number: invoiceNumber,
            client_name: '', // Client name should be manually input by user
            issue_date: extractedData.date || new Date().toISOString().split('T')[0],
            items: JSON.stringify(extractedData.items || []),
            subtotal: subtotal,
            tax_amount: taxAmount,
            total_amount: total,
            status: 'draft'
          }])
          .select()
          .single();
          
        if (!invoiceError) {
          invoice = invoiceData;
          
          // Increment user's invoice count
          await supabase.rpc('increment_invoice_count', { user_uuid: user.id });
        }
      } catch (invoiceError) {
        console.error('Failed to create invoice:', invoiceError);
        // Continue - receipt was uploaded successfully
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      receipt: {
        id: receipt.id,
        url: publicUrl.publicUrl,
        ocrProcessed,
        ocrText: ocrProcessed ? ocrText : null
      },
      invoice: invoice ? {
        id: invoice.id,
        invoiceNumber: invoice.invoice_number
      } : null
    }));
    
  } catch (err) {
    console.error('Upload error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
