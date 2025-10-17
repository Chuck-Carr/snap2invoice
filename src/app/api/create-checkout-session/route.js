import { stripe } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req) {
  try {
    const { userEmail } = await req.json();

    if (!userEmail) {
      return new Response(JSON.stringify({ error: 'User email is required' }), { 
        status: 400 
      });
    }

    // This is a legacy API - redirect to use new multi-plan checkout
    return new Response(JSON.stringify({ 
      error: 'This API is deprecated. Please use /api/create-subscription-checkout with planId parameter.' 
    }), { 
      status: 410 // Gone
    });

    // Legacy API is deprecated - no longer functional

  } catch (error) {
    console.error('Stripe checkout error:', error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500 
    });
  }
}