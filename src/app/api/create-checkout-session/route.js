import { stripe, STRIPE_PRICE_ID } from '../../../../lib/stripe';
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

    if (!STRIPE_PRICE_ID) {
      return new Response(JSON.stringify({ error: 'Stripe price ID not configured' }), { 
        status: 500 
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

    // Create or get Stripe customer
    let customerId;
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    if (profile?.stripe_customer_id) {
      customerId = profile.stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: {
          supabase_user_id: user.id
        }
      });
      customerId = customer.id;

      // Save customer ID to profile
      await supabase
        .from('user_profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${req.headers.get('origin')}/account?success=true`,
      cancel_url: `${req.headers.get('origin')}/account?canceled=true`,
      metadata: {
        user_id: user.id,
        user_email: userEmail
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          user_email: userEmail
        }
      }
    });

    return new Response(JSON.stringify({ url: session.url }));

  } catch (error) {
    console.error('Stripe checkout error:', error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500 
    });
  }
}