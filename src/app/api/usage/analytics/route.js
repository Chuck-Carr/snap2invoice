import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUserUsageAnalytics, initializeUsageTracking } from '../../../../lib/usage-tracker.js';
import { PRICING_PLANS, formatCurrency } from '../../../../lib/pricing.js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

export async function GET(request) {
  try {
    // Get user from auth header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Initialize usage tracking (ensure tables exist)
    await initializeUsageTracking();
    
    const userId = user.id;
    
    const analytics = await getUserUsageAnalytics(userId);
    
    // Add pricing plan details
    const planDetails = PRICING_PLANS[analytics.subscription.planId.toUpperCase()];
    
    const response = {
      success: true,
      subscription: {
        ...analytics.subscription,
        planDetails: {
          name: planDetails.name,
          description: planDetails.description,
          monthlyFee: formatCurrency(planDetails.monthlyFee),
          includedReceipts: planDetails.includedReceipts,
          overageRate: formatCurrency(planDetails.overageRate),
          features: planDetails.features
        }
      },
      currentMonth: {
        ...analytics.currentMonth,
        bill: {
          ...analytics.currentMonth.bill,
          formattedBaseFee: formatCurrency(analytics.currentMonth.bill.baseFee),
          formattedOverageCharges: formatCurrency(analytics.currentMonth.bill.overageCharges),
          formattedTotalBill: formatCurrency(analytics.currentMonth.bill.totalBill)
        },
        remainingReceipts: Math.max(0, planDetails.includedReceipts - analytics.currentMonth.receiptsProcessed),
        percentageUsed: Math.round((analytics.currentMonth.receiptsProcessed / planDetails.includedReceipts) * 100),
        projectedBill: formatCurrency(analytics.currentMonth.bill.totalBill)
      },
      history: analytics.history,
      recentEvents: analytics.recentEvents,
      availablePlans: Object.values(PRICING_PLANS).map(plan => ({
        id: plan.id,
        name: plan.name,
        description: plan.description,
        monthlyFee: formatCurrency(plan.monthlyFee),
        includedReceipts: plan.includedReceipts,
        overageRate: formatCurrency(plan.overageRate),
        features: plan.features
      }))
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('❌ Usage analytics error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}