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

    console.log(`Creating profile for user: ${user.email} (${user.id})`);

    // Check if profile already exists
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (existingProfile) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Profile already exists',
        profile: existingProfile
      }));
    }

    // Create the missing profile
    const { data: newProfile, error: insertError } = await supabase
      .from('user_profiles')
      .insert([{
        id: user.id,
        email: user.email,
        subscription_plan: 'free',
        invoices_this_month: 0,
        month_year: new Date().toISOString().slice(0, 7)
      }])
      .select()
      .single();

    if (insertError) {
      console.error('Profile creation error:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to create profile: ' + insertError.message }), { 
        status: 500 
      });
    }

    console.log(`Successfully created profile for user: ${user.email}`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Profile created successfully',
      profile: newProfile
    }));

  } catch (err) {
    console.error('Fix profile error:', err);
    return new Response(JSON.stringify({ error: 'Failed to fix profile' }), { status: 500 });
  }
}