# Stripe Integration Setup Guide

This guide will help you set up Stripe for premium subscriptions in Snap2Invoice.

## Prerequisites

1. A Stripe account (create one at [https://stripe.com](https://stripe.com))
2. Your Supabase project with the user_profiles table set up

## Step 1: Database Migration

First, add the required Stripe fields to your database:

1. Go to your Supabase dashboard
2. Navigate to the SQL Editor
3. Run the migration script:

```sql
-- Add Stripe-related fields to user_profiles table
ALTER TABLE user_profiles
ADD COLUMN stripe_customer_id TEXT,
ADD COLUMN stripe_subscription_id TEXT,
ADD COLUMN subscription_cancelled_at TIMESTAMPTZ;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe_customer_id ON user_profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe_subscription_id ON user_profiles(stripe_subscription_id);

-- Add comment to document the new columns
COMMENT ON COLUMN user_profiles.stripe_customer_id IS 'Stripe customer ID for billing';
COMMENT ON COLUMN user_profiles.stripe_subscription_id IS 'Stripe subscription ID for premium plan';
COMMENT ON COLUMN user_profiles.subscription_cancelled_at IS 'Timestamp when subscription was cancelled (null if active)';
```

## Step 2: Create a Stripe Product and Price

1. Log into your Stripe Dashboard
2. Go to Products → Create Product
3. Set up your premium plan:
   - **Name**: "Premium Plan" (or whatever you prefer)
   - **Pricing**: Recurring monthly subscription (e.g., $9.99/month)
   - **Billing period**: Monthly
4. Copy the **Price ID** (starts with `price_...`)

## Step 3: Environment Variables

Update your `.env.local` file with your Stripe credentials:

```bash
# STRIPE CONFIG
STRIPE_SECRET_KEY=sk_test_... # Your Stripe secret key (test mode)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_... # Your Stripe publishable key (test mode)
STRIPE_WEBHOOK_SECRET=whsec_... # Your webhook endpoint secret (see Step 4)
STRIPE_PRICE_ID=price_... # The price ID from Step 2
```

### Getting your Stripe Keys:

1. In Stripe Dashboard, go to **Developers** → **API Keys**
2. Copy the **Publishable key** (starts with `pk_test_...`)
3. Click "Reveal test key" for the **Secret key** (starts with `sk_test_...`)

## Step 4: Set up Webhooks

Webhooks are crucial for handling subscription events (payments, cancellations, etc.).

### 4.1 Create Webhook Endpoint

1. In Stripe Dashboard, go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Set the endpoint URL to: `https://yourdomain.com/api/stripe-webhook`
   - For local development: `https://your-ngrok-url.ngrok.io/api/stripe-webhook`
4. Select these events to listen for:
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`

### 4.2 Get Webhook Secret

1. After creating the webhook, click on it
2. In the **Signing secret** section, click **Reveal**
3. Copy the secret (starts with `whsec_...`) to your `.env.local`

### 4.3 Local Development with ngrok (optional)

For local testing, you'll need to expose your local server:

```bash
# Install ngrok if you haven't already
npm install -g ngrok

# In another terminal, expose your local server
ngrok http 3000

# Use the HTTPS URL for your webhook endpoint
```

## Step 5: Test the Integration

1. Start your development server: `npm run dev`
2. Create a test user account
3. Go to the Account page
4. Click "Upgrade to Premium"
5. Use Stripe's test card: `4242 4242 4242 4242`
   - Any expiry date in the future
   - Any 3-digit CVC

## Step 6: Subscription Flow

### User Upgrades:
1. User clicks "Upgrade to Premium"
2. They're redirected to Stripe Checkout
3. After successful payment, webhook handles the subscription activation
4. User gets premium access immediately

### User Cancels:
1. User clicks "Cancel Subscription"
2. Subscription is cancelled but remains active until the end of the billing period
3. User retains premium access until expiry date
4. After expiry, they're automatically downgraded to free plan

## Production Deployment

### Environment Variables for Production:

```bash
# Replace test keys with live keys
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_... # Create a new webhook for production
STRIPE_PRICE_ID=price_... # Use your live price ID
```

### Important Security Notes:

1. Never commit your `.env.local` file to version control
2. Use live keys only in production
3. Verify webhook signatures in production (already handled in the code)
4. Set up proper error monitoring for webhook failures

## Troubleshooting

### Common Issues:

1. **Webhook not receiving events**: Check your endpoint URL and make sure it's accessible
2. **Payments not updating user status**: Check webhook event types and webhook secret
3. **Local development issues**: Make sure ngrok is running and webhook URL is updated

### Debugging:

1. Check Stripe Dashboard → **Developers** → **Events** for webhook delivery logs
2. Check your server logs for webhook processing errors
3. Use Stripe CLI for local webhook testing: `stripe listen --forward-to localhost:3000/api/stripe-webhook`

## Support

- Stripe Documentation: [https://stripe.com/docs](https://stripe.com/docs)
- Stripe Test Cards: [https://stripe.com/docs/testing](https://stripe.com/docs/testing)