import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { updateUserPlan, getUserSubscription, initializeUsageTracking } from '@/lib/usage-tracker';
import { PRICING_PLANS } from '@/lib/pricing';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

export async function POST(request) {
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
    
    const { planId } = await request.json();
    
    // Validate plan ID
    if (!planId || !PRICING_PLANS[planId.toUpperCase()]) {
      return NextResponse.json({
        success: false,
        error: `Invalid plan ID: ${planId}`
      }, { status: 400 });
    }
    
    const userId = user.id;
    
    // Get current subscription
    const currentSubscription = await getUserSubscription(userId);
    const oldPlan = PRICING_PLANS[currentSubscription.plan_id.toUpperCase()];
    const newPlan = PRICING_PLANS[planId.toUpperCase()];
    
    // Update the user's plan
    await updateUserPlan(userId, planId.toLowerCase());
    
    console.log(`✅ Updated user ${userId} from ${oldPlan.name} to ${newPlan.name}`);
    
    return NextResponse.json({
      success: true,
      message: `Successfully upgraded to ${newPlan.name} plan`,
      oldPlan: {
        id: oldPlan.id,
        name: oldPlan.name
      },
      newPlan: {
        id: newPlan.id,
        name: newPlan.name,
        monthlyFee: newPlan.monthlyFee,
        includedReceipts: newPlan.includedReceipts,
        overageRate: newPlan.overageRate
      }
    });
    
  } catch (error) {
    console.error('❌ Plan update error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

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
    
    const subscription = await getUserSubscription(userId);
    const planDetails = PRICING_PLANS[subscription.plan_id.toUpperCase()];
    
    return NextResponse.json({
      success: true,
      currentPlan: {
        id: planDetails.id,
        name: planDetails.name,
        description: planDetails.description,
        monthlyFee: planDetails.monthlyFee,
        includedReceipts: planDetails.includedReceipts,
        overageRate: planDetails.overageRate,
        features: planDetails.features
      },
      availablePlans: Object.values(PRICING_PLANS).map(plan => ({
        id: plan.id,
        name: plan.name,
        description: plan.description,
        monthlyFee: plan.monthlyFee,
        includedReceipts: plan.includedReceipts,
        overageRate: plan.overageRate,
        features: plan.features,
        isCurrent: plan.id === planDetails.id
      }))
    });
    
  } catch (error) {
    console.error('❌ Get plan error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}