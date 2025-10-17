import { stripe } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';
import { updateUserPlan, initializeUsageTracking } from '@/lib/usage-tracker';
import { PRICING_PLANS } from '@/lib/pricing';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Map Stripe price IDs to plan IDs
const STRIPE_PRICE_TO_PLAN = {
  [process.env.STRIPE_STARTER_PRICE_ID]: 'starter',
  [process.env.STRIPE_PRO_PRICE_ID]: 'pro',
};

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req) {
  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!webhookSecret) {
      console.error('Stripe webhook secret not configured');
      return new Response('Webhook secret not configured', { status: 500 });
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    console.log('Received Stripe event:', event.type);

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object);
        break;
        
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object);
        break;
        
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
        
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response('Success', { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(`Webhook Error: ${error.message}`, { status: 500 });
  }
}

async function handleCheckoutSessionCompleted(session) {
  const userId = session.metadata.user_id;
  const planId = session.metadata.plan_id;
  const subscriptionId = session.subscription;

  if (!userId || !subscriptionId || !planId) {
    console.error('Missing required metadata in checkout session:', {
      userId,
      planId,
      subscriptionId
    });
    return;
  }

  try {
    // Initialize usage tracking tables if needed
    await initializeUsageTracking();

    // Get subscription details from Stripe
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const priceId = subscription.items.data[0]?.price?.id;
    
    // Verify the plan matches what was purchased
    const expectedPlan = STRIPE_PRICE_TO_PLAN[priceId];
    if (expectedPlan !== planId) {
      console.error(`Plan mismatch: expected ${expectedPlan}, got ${planId}`);
    }
    
    // Update user to new plan using usage tracker
    await updateUserPlan(userId, planId);
    
    // Update user profile with Stripe subscription details
    await supabase
      .from('user_profiles')
      .upsert({
        id: userId,
        subscription_plan: planId,
        stripe_subscription_id: subscriptionId,
        subscription_expires_at: new Date(subscription.current_period_end * 1000).toISOString(),
        subscription_cancelled_at: null,
        updated_at: new Date().toISOString()
      });

    const plan = PRICING_PLANS[planId.toUpperCase()];
    console.log(`✅ Subscription activated: User ${userId} upgraded to ${plan.name} plan`);
    
  } catch (error) {
    console.error('❌ Error handling checkout session completed:', error);
    throw error;
  }
}

async function handleInvoicePaymentSucceeded(invoice) {
  const subscriptionId = invoice.subscription;
  
  if (!subscriptionId) return;

  // Get subscription details
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const customerId = subscription.customer;

  // Find user by customer ID
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('stripe_customer_id', customerId);

  if (!profiles || profiles.length === 0) {
    console.error(`No user found for customer ${customerId}`);
    return;
  }

  const userId = profiles[0].id;

  // Update subscription expiry date
  await supabase
    .from('user_profiles')
    .update({
      subscription_expires_at: new Date(subscription.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);

  console.log(`Subscription renewed for user ${userId}`);
}

async function handleSubscriptionUpdated(subscription) {
  const customerId = subscription.customer;

  // Find user by customer ID
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('stripe_customer_id', customerId);

  if (!profiles || profiles.length === 0) {
    console.error(`No user found for customer ${customerId}`);
    return;
  }

  const userId = profiles[0].id;

  // Update subscription details
  const updates = {
    subscription_expires_at: new Date(subscription.current_period_end * 1000).toISOString(),
    updated_at: new Date().toISOString()
  };

  // If subscription is cancelled, mark it but keep premium access until period end
  if (subscription.cancel_at_period_end) {
    updates.subscription_cancelled_at = new Date().toISOString();
  }

  await supabase
    .from('user_profiles')
    .update(updates)
    .eq('id', userId);

  console.log(`Subscription updated for user ${userId}`);
}

async function handleSubscriptionDeleted(subscription) {
  const customerId = subscription.customer;

  try {
    // Find user by customer ID
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('stripe_customer_id', customerId);

    if (!profiles || profiles.length === 0) {
      console.error(`No user found for customer ${customerId}`);
      return;
    }

    const userId = profiles[0].id;
    
    // Initialize usage tracking
    await initializeUsageTracking();

    // Downgrade user to free plan using usage tracker
    await updateUserPlan(userId, 'free');

    // Update user profile
    await supabase
      .from('user_profiles')
      .update({
        subscription_plan: 'free',
        stripe_subscription_id: null,
        subscription_expires_at: null,
        subscription_cancelled_at: null,
        logo_url: null, // Remove custom logo
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    console.log(`✅ Subscription ended: User ${userId} downgraded to free plan`);
    
  } catch (error) {
    console.error('❌ Error handling subscription deleted:', error);
    throw error;
  }
}
