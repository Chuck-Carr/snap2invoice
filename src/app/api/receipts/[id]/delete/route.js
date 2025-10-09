import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function DELETE(req, { params }) {
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

    const { id: receiptId } = await params;

    // First, get the receipt to verify ownership and get file URL
    const { data: receipt, error: receiptError } = await supabase
      .from('receipts')
      .select('id, user_id, file_url, invoice_id')
      .eq('id', receiptId)
      .eq('user_id', user.id)
      .single();

    if (receiptError || !receipt) {
      return new Response(JSON.stringify({ error: 'Receipt not found' }), { status: 404 });
    }

    // Check if receipt is linked to an invoice
    if (receipt.invoice_id) {
      return new Response(JSON.stringify({ 
        error: 'Cannot delete receipt that is linked to an invoice. Remove from invoice first.' 
      }), { status: 400 });
    }

    // Delete the file from storage
    if (receipt.file_url) {
      try {
        // Extract file path from URL
        const url = new URL(receipt.file_url);
        const pathSegments = url.pathname.split('/');
        const fileName = pathSegments[pathSegments.length - 1];
        const filePath = `receipts/${user.id}/${fileName}`;
        
        const { error: storageError } = await supabase.storage
          .from('receipts')
          .remove([filePath]);
          
        if (storageError) {
          console.error('Failed to delete file from storage:', storageError);
          // Continue with database deletion even if file deletion fails
        }
      } catch (urlError) {
        console.error('Error parsing file URL:', urlError);
        // Continue with database deletion
      }
    }

    // Delete the receipt record
    const { error: deleteError } = await supabase
      .from('receipts')
      .delete()
      .eq('id', receiptId)
      .eq('user_id', user.id);

    if (deleteError) throw deleteError;

    return new Response(JSON.stringify({
      success: true,
      message: 'Receipt deleted successfully'
    }));

  } catch (err) {
    console.error('Delete receipt error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}