import { createClient } from '@supabase/supabase-js';
import { updateUserPlan, getUserSubscription } from '../../../lib/usage-tracker.js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req) {
  try {
    // Get user from auth header (for new pay-per-use system)
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

    // Get current subscription from pay-per-use system
    const currentSubscription = await getUserSubscription(user.id);
    
    if (currentSubscription.plan_id === 'free') {
      return new Response(JSON.stringify({ 
        error: 'User is already on the free plan' 
      }), { status: 400 });
    }

    // Downgrade to free plan
    await updateUserPlan(user.id, 'free');

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Successfully downgraded to free plan',
      newPlan: 'free',
      receiptsAllowed: 5
    }));

  } catch (error) {
    console.error('Plan downgrade error:', error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500 
    });
  }
}
