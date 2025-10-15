/**
 * Usage tracking system for pay-per-use billing
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Initialize usage tracking tables - No-op for Supabase (tables created via migration)
 */
export async function initializeUsageTracking() {
  // Tables are created via SQL migration in Supabase
  // This function exists for compatibility but does nothing
  console.log('✅ Usage tracking tables ready (Supabase)');
  return true;
}

/**
 * Get or create user subscription
 */
export async function getUserSubscription(userId) {
  // Try to get existing subscription
  const { data: user, error } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code === 'PGRST116') {
    // User doesn't exist, create new subscription with free plan
    const { data: newUser, error: insertError } = await supabase
      .from('user_subscriptions')
      .insert([{ user_id: userId, plan_id: 'free' }])
      .select()
      .single();
      
    if (insertError) {
      throw new Error(`Failed to create subscription: ${insertError.message}`);
    }
    
    return newUser;
  } else if (error) {
    throw new Error(`Database error: ${error.message}`);
  }

  return user;
}

/**
 * Update user's subscription plan
 */
export async function updateUserPlan(userId, planId) {
  const { error } = await supabase
    .from('user_subscriptions')
    .update({ plan_id: planId })
    .eq('user_id', userId);
    
  if (error) {
    throw new Error(`Failed to update plan: ${error.message}`);
  }

  console.log(`✅ Updated user ${userId} to ${planId} plan`);
}

/**
 * Get current month's usage for a user
 */
export async function getCurrentMonthUsage(userId) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const { data: usage, error } = await supabase
    .from('monthly_usage')
    .select('*')
    .eq('user_id', userId)
    .eq('year', year)
    .eq('month', month)
    .single();

  if (error && error.code === 'PGRST116') {
    // No usage record exists, create one
    const { data: newUsage, error: insertError } = await supabase
      .from('monthly_usage')
      .insert([{ user_id: userId, year, month, receipts_processed: 0, total_charges: 0 }])
      .select()
      .single();
      
    if (insertError) {
      throw new Error(`Failed to create usage record: ${insertError.message}`);
    }
    
    return newUsage;
  } else if (error) {
    throw new Error(`Database error: ${error.message}`);
  }

  return usage;
}

/**
 * Record a receipt upload event
 */
export async function recordReceiptUpload(userId, cost = 0, metadata = {}) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  // Record the event
  const { error: eventError } = await supabase
    .from('usage_events')
    .insert([{
      user_id: userId,
      event_type: 'receipt_upload',
      cost: cost,
      metadata: metadata
    }]);
    
  if (eventError) {
    throw new Error(`Failed to record event: ${eventError.message}`);
  }

  // Get or create monthly usage record
  const usage = await getCurrentMonthUsage(userId);
  
  // Update monthly usage
  const { error: updateError } = await supabase
    .from('monthly_usage')
    .update({
      receipts_processed: usage.receipts_processed + 1,
      total_charges: parseFloat(usage.total_charges) + cost
    })
    .eq('user_id', userId)
    .eq('year', year)
    .eq('month', month);
    
  if (updateError) {
    throw new Error(`Failed to update usage: ${updateError.message}`);
  }

  console.log(`📈 Recorded receipt upload for user ${userId}, cost: $${cost}`);
}

/**
 * Check if user can upload more receipts
 */
export async function canUserUploadReceipt(userId) {
  const subscription = await getUserSubscription(userId);
  const usage = await getCurrentMonthUsage(userId);
  
  // Import pricing functions
  const { checkUsageLimit } = await import('./pricing.js');
  const usageStatus = checkUsageLimit(subscription.plan_id, usage.receipts_processed);

  return {
    canUpload: usageStatus.canUpload,
    planName: usageStatus.planName,
    currentUsage: usageStatus.currentUsage,
    remaining: usageStatus.remaining,
    nextReceiptCost: usageStatus.nextReceiptCost,
    isOverage: usageStatus.isOverage,
    message: usageStatus.canUpload 
      ? `You can upload this receipt. ${usageStatus.remaining} receipts remaining in your ${usageStatus.planName} plan.`
      : `Upload limit reached. Upgrade your plan to upload more receipts.`
  };
}

/**
 * Calculate current month's bill for a user
 */
export async function calculateCurrentBill(userId) {
  const subscription = await getUserSubscription(userId);
  const usage = await getCurrentMonthUsage(userId);
  
  const { calculateMonthlyBill } = await import('./pricing.js');
  return calculateMonthlyBill(subscription.plan_id, usage.receipts_processed);
}

/**
 * Get usage history for a user
 */
export async function getUserUsageHistory(userId, months = 6) {
  const { data: history, error } = await supabase
    .from('monthly_usage')
    .select('year, month, receipts_processed, total_charges, created_at')
    .eq('user_id', userId)
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(months);
    
  if (error) {
    throw new Error(`Failed to get usage history: ${error.message}`);
  }

  return (history || []).map(row => ({
    ...row,
    period: `${row.year}-${String(row.month).padStart(2, '0')}`,
    formattedCharges: new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(row.total_charges)
  }));
}

/**
 * Get usage analytics for dashboard
 */
export async function getUserUsageAnalytics(userId) {
  // Current month usage
  const currentUsage = await getCurrentMonthUsage(userId);
  const subscription = await getUserSubscription(userId);
  const currentBill = await calculateCurrentBill(userId);
  
  // Last 6 months trend
  const history = await getUserUsageHistory(userId, 6);
  
  // Usage events this month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const { data: recentEvents, error: eventsError } = await supabase
    .from('usage_events')
    .select('event_type, cost, created_at, metadata')
    .eq('user_id', userId)
    .gte('created_at', monthStart.toISOString())
    .order('created_at', { ascending: false })
    .limit(20);
    
  if (eventsError) {
    throw new Error(`Failed to get recent events: ${eventsError.message}`);
  }

  return {
    subscription: {
      planId: subscription.plan_id,
      planName: subscription.plan_id.charAt(0).toUpperCase() + subscription.plan_id.slice(1)
    },
    currentMonth: {
      receiptsProcessed: currentUsage.receipts_processed,
      totalCharges: currentUsage.total_charges,
      bill: currentBill
    },
    history,
    recentEvents: (recentEvents || []).map(event => ({
      ...event,
      metadata: typeof event.metadata === 'string' ? JSON.parse(event.metadata) : event.metadata,
      formattedCost: new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(event.cost)
    }))
  };
}
