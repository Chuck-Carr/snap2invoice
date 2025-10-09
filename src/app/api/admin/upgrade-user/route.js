import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Admin secret key for testing - you can change this
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'snap2invoice-admin-test-key-2024';

export async function POST(req) {
  try {
    const { adminSecret, userEmail, action } = await req.json();

    // Verify admin secret
    if (adminSecret !== ADMIN_SECRET) {
      return new Response(JSON.stringify({ error: 'Invalid admin secret' }), { 
        status: 403 
      });
    }

    if (!userEmail || !action) {
      return new Response(JSON.stringify({ error: 'Missing userEmail or action' }), { 
        status: 400 
      });
    }

    // Find user by email
    const { data: userData, error: userError } = await supabase.auth.admin.listUsers();
    if (userError) throw userError;

    const user = userData.users.find(u => u.email === userEmail);
    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), { 
        status: 404 
      });
    }

    let updates = {};
    
    if (action === 'upgrade') {
      updates = {
        subscription_plan: 'premium',
        subscription_expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
        updated_at: new Date().toISOString()
      };
    } else if (action === 'downgrade') {
      updates = {
        subscription_plan: 'free',
        subscription_expires_at: null,
        logo_url: null, // Remove custom logo
        updated_at: new Date().toISOString()
      };
    } else if (action === 'reset-usage') {
      updates = {
        invoices_this_month: 0,
        month_year: new Date().toISOString().slice(0, 7), // Current month
        updated_at: new Date().toISOString()
      };
    } else {
      return new Response(JSON.stringify({ error: 'Invalid action' }), { 
        status: 400 
      });
    }

    // Update user profile
    const { data, error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ 
      success: true, 
      message: `User ${userEmail} ${action} completed successfully`,
      profile: data
    }));

  } catch (err) {
    console.error('Admin upgrade error:', err);
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500 
    });
  }
}