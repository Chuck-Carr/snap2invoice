import { stripe } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';
import { PRICING_PLANS } from '@/lib/pricing';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Stripe Price IDs - these should be environment variables
const STRIPE_PRICE_IDS = {
  starter: process.env.STRIPE_STARTER_PRICE_ID,
  pro: process.env.STRIPE_PRO_PRICE_ID,
};

export async function POST(req) {
  try {
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

    const { planId, successUrl, cancelUrl } = await req.json();

    if (!planId || !PRICING_PLANS[planId.toUpperCase()]) {
      return new Response(JSON.stringify({ error: 'Invalid plan ID' }), { status: 400 });
    }

    // Don't allow checkout for free plan
    if (planId.toLowerCase() === 'free') {
      return new Response(JSON.stringify({ error: 'Cannot create checkout for free plan' }), { status: 400 });
    }

    const stripePriceId = STRIPE_PRICE_IDS[planId.toLowerCase()];
    if (!stripePriceId) {
      return new Response(JSON.stringify({ error: `Stripe price ID not configured for ${planId} plan` }), { 
        status: 500 
      });
    }

    // Get or create user profile
    let { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('stripe_customer_id, business_name, business_email')
      .eq('id', user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') { // PGRST116 is "not found"
      throw profileError;
    }

    // Create or get Stripe customer
    let customerId = profile?.stripe_customer_id;
    
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: profile?.business_name || user.email.split('@')[0],
        metadata: {
          supabase_user_id: user.id,
          plan_requested: planId.toLowerCase()
        }
      });
      customerId = customer.id;

      // Update or create profile with customer ID
      await supabase
        .from('user_profiles')
        .upsert({
          id: user.id,
          email: user.email,
          stripe_customer_id: customerId,
          business_email: profile?.business_email || user.email,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
    }

    const plan = PRICING_PLANS[planId.toUpperCase()];
    
    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      billing_address_collection: 'required',
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl || `${req.headers.get('origin')}/account?success=true&plan=${planId}`,
      cancel_url: cancelUrl || `${req.headers.get('origin')}/account?canceled=true`,
      metadata: {
        user_id: user.id,
        user_email: user.email,
        plan_id: planId.toLowerCase()
      },
      subscription_data: {
        trial_period_days: 7, // Optional 7-day trial
        metadata: {
          user_id: user.id,
          user_email: user.email,
          plan_id: planId.toLowerCase()
        }
      },
      customer_update: {
        address: 'auto',
        name: 'auto'
      },
      tax_id_collection: {
        enabled: true
      },
      automatic_tax: {
        enabled: true
      },
      allow_promotion_codes: true
    });

    console.log(`✅ Created Stripe checkout session for user ${user.id} upgrading to ${plan.name}`);

    return new Response(JSON.stringify({ 
      url: session.url,
      sessionId: session.id,
      planName: plan.name,
      monthlyFee: plan.monthlyFee
    }));

  } catch (error) {
    console.error('❌ Stripe checkout error:', error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500 
    });
  }
}