import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function DELETE(req) {
  try {
    // Get user from auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    // Create client with user's token to verify identity
    const token = authHeader.replace('Bearer ', '');
    const userSupabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });

    // Get and verify user
    const { data: { user }, error: authError } = await userSupabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    // Get confirmation from request body
    const { confirmationText } = await req.json();
    
    if (confirmationText !== 'DELETE MY ACCOUNT') {
      return new Response(JSON.stringify({ error: 'Invalid confirmation text' }), { status: 400 });
    }

    console.log(`Deleting account for user: ${user.email} (${user.id})`);

    // Delete user profile (this will cascade to delete invoices and receipts due to foreign key constraints)
    const { error: profileError } = await supabase
      .from('user_profiles')
      .delete()
      .eq('id', user.id);

    if (profileError) {
      console.error('Profile deletion error:', profileError);
      // Don't return early - continue with auth user deletion
    }

    // Delete files from storage (user's folder)
    try {
      const { data: files } = await supabase.storage
        .from('receipts')
        .list(`${user.id}/`);

      if (files && files.length > 0) {
        const filePaths = files.map(file => `${user.id}/${file.name}`);
        await supabase.storage
          .from('receipts')
          .remove(filePaths);
      }

      // Also clean up logos if any
      const { data: logoFiles } = await supabase.storage
        .from('receipts')
        .list(`logos/${user.id}/`);

      if (logoFiles && logoFiles.length > 0) {
        const logoFilePaths = logoFiles.map(file => `logos/${user.id}/${file.name}`);
        await supabase.storage
          .from('receipts')
          .remove(logoFilePaths);
      }
    } catch (storageError) {
      console.error('Storage cleanup error:', storageError);
      // Continue anyway
    }

    // Delete the auth user using service role
    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
    
    if (deleteError) {
      console.error('Auth user deletion error:', deleteError);
      return new Response(JSON.stringify({ 
        error: 'Failed to delete account completely. Please contact support.' 
      }), { status: 500 });
    }

    console.log(`Successfully deleted account for user: ${user.email}`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Account deleted successfully' 
    }));

  } catch (err) {
    console.error('Account deletion error:', err);
    return new Response(JSON.stringify({ error: 'Failed to delete account' }), { status: 500 });
  }
}