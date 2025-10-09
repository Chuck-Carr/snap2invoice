import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req, { params }) {
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

    const { id: invoiceId } = await params;
    const { receiptIds } = await req.json();

    if (!receiptIds || !Array.isArray(receiptIds) || receiptIds.length === 0) {
      return new Response(JSON.stringify({ error: 'Receipt IDs are required' }), { status: 400 });
    }

    // Verify that the invoice belongs to the user
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('id, user_id')
      .eq('id', invoiceId)
      .eq('user_id', user.id)
      .single();

    if (invoiceError || !invoice) {
      return new Response(JSON.stringify({ error: 'Invoice not found' }), { status: 404 });
    }

    // Verify that all receipts belong to the user and are not already linked to another invoice
    const { data: receipts, error: receiptsError } = await supabase
      .from('receipts')
      .select('id, user_id, invoice_id')
      .in('id', receiptIds)
      .eq('user_id', user.id);

    if (receiptsError) throw receiptsError;

    if (receipts.length !== receiptIds.length) {
      return new Response(JSON.stringify({ 
        error: 'Some receipts not found' 
      }), { status: 400 });
    }

    // Check if any receipts are already linked to other invoices
    const alreadyLinkedReceipts = receipts.filter(receipt => 
      receipt.invoice_id && receipt.invoice_id !== invoiceId
    );

    if (alreadyLinkedReceipts.length > 0) {
      return new Response(JSON.stringify({ 
        error: 'Some receipts are already linked to other invoices' 
      }), { status: 400 });
    }

    // Update receipts to link them to the invoice
    const { data: updatedReceipts, error: updateError } = await supabase
      .from('receipts')
      .update({ invoice_id: invoiceId })
      .in('id', receiptIds)
      .eq('user_id', user.id)
      .select();

    if (updateError) throw updateError;

    return new Response(JSON.stringify({
      success: true,
      message: `Successfully linked ${updatedReceipts.length} receipt(s) to invoice`,
      linkedReceipts: updatedReceipts
    }));

  } catch (err) {
    console.error('Add receipts to invoice error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}