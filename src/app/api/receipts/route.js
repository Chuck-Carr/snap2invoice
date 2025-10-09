import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(req) {
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

    // Fetch all receipts for the user
    const { data: receipts, error: receiptsError } = await supabase
      .from('receipts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (receiptsError) throw receiptsError;

    // For each receipt, fetch associated invoice if it exists (using invoice_id in receipts table)
    const receiptsWithInvoices = await Promise.all(
      receipts.map(async (receipt) => {
        if (receipt.invoice_id) {
          const { data: invoice } = await supabase
            .from('invoices')
            .select('id, invoice_number, client_name, total_amount, status')
            .eq('id', receipt.invoice_id)
            .single();
          
          return { ...receipt, invoices: invoice ? [invoice] : [] };
        }
        return { ...receipt, invoices: [] };
      })
    );

    return new Response(JSON.stringify({ 
      success: true, 
      receipts: receiptsWithInvoices || []
    }));
    
  } catch (err) {
    console.error('Receipts fetch error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}