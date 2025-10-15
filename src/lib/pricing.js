/**
 * Pay-per-use pricing structure configuration
 */

export const PRICING_PLANS = {
  FREE: {
    id: 'free',
    name: 'Free',
    description: 'Perfect for trying out the service',
    monthlyFee: 0,
    includedReceipts: 5,
    overageRate: 0, // No overage allowed on free tier
    features: [
      '5 receipts per month',
      'Basic OCR processing',
      'PDF invoice generation',
      'Email support'
    ],
    limits: {
      maxReceipts: 5,
      allowOverage: false
    }
  },
  
  STARTER: {
    id: 'starter',
    name: 'Starter',
    description: 'Great for small businesses and freelancers',
    monthlyFee: 15.00,
    includedReceipts: 100,
    overageRate: 0.15,
    features: [
      '100 receipts per month included',
      '$0.15 per additional receipt',
      'Advanced AI OCR processing',
      'PDF invoice generation',
      'Usage dashboard',
      'Priority email support'
    ],
    limits: {
      maxReceipts: null, // Unlimited with overage
      allowOverage: true
    }
  },
  
  PRO: {
    id: 'pro',
    name: 'Pro',
    description: 'Best value for high-volume users',
    monthlyFee: 25.00,
    includedReceipts: 300,
    overageRate: 0.10,
    features: [
      '300 receipts per month included',
      '$0.10 per additional receipt',
      'Premium AI OCR processing',
      'PDF invoice generation',
      'Advanced usage analytics',
      'Priority support',
      'API access'
    ],
    limits: {
      maxReceipts: null, // Unlimited with overage
      allowOverage: true
    }
  }
};

/**
 * Calculate monthly bill for a user
 * @param {string} planId - The user's plan ID
 * @param {number} receiptsUsed - Number of receipts used this month
 * @returns {object} Billing breakdown
 */
export function calculateMonthlyBill(planId, receiptsUsed) {
  const plan = PRICING_PLANS[planId.toUpperCase()];
  if (!plan) {
    throw new Error(`Invalid plan ID: ${planId}`);
  }

  const baseFee = plan.monthlyFee;
  const includedReceipts = plan.includedReceipts;
  const overageReceipts = Math.max(0, receiptsUsed - includedReceipts);
  const overageCharges = overageReceipts * plan.overageRate;
  const totalBill = baseFee + overageCharges;

  return {
    planName: plan.name,
    baseFee,
    includedReceipts,
    receiptsUsed,
    overageReceipts,
    overageRate: plan.overageRate,
    overageCharges,
    totalBill,
    breakdown: {
      baseFee: {
        amount: baseFee,
        description: `${plan.name} plan (${includedReceipts} receipts included)`
      },
      overage: {
        amount: overageCharges,
        description: `${overageReceipts} additional receipts at $${plan.overageRate} each`
      }
    }
  };
}

/**
 * Check if user can upload more receipts
 * @param {string} planId - The user's plan ID
 * @param {number} currentUsage - Current receipts used this month
 * @returns {object} Usage status
 */
export function checkUsageLimit(planId, currentUsage) {
  const plan = PRICING_PLANS[planId.toUpperCase()];
  if (!plan) {
    throw new Error(`Invalid plan ID: ${planId}`);
  }

  const includedReceipts = plan.includedReceipts;
  const remaining = Math.max(0, includedReceipts - currentUsage);
  const isOverage = currentUsage > includedReceipts;
  const canUpload = plan.limits.allowOverage || currentUsage < includedReceipts;

  return {
    planName: plan.name,
    includedReceipts,
    currentUsage,
    remaining,
    isOverage,
    canUpload,
    nextReceiptCost: isOverage ? plan.overageRate : 0,
    projectedMonthlyBill: calculateMonthlyBill(planId, currentUsage + 1).totalBill
  };
}

/**
 * Get upgrade recommendations
 * @param {number} monthlyUsage - Average monthly usage
 * @returns {object} Plan recommendations
 */
export function getUpgradeRecommendation(monthlyUsage) {
  const plans = Object.values(PRICING_PLANS);
  const recommendations = [];

  for (const plan of plans) {
    if (plan.id === 'free') continue;

    const bill = calculateMonthlyBill(plan.id, monthlyUsage);
    recommendations.push({
      planId: plan.id,
      planName: plan.name,
      monthlyFee: plan.monthlyFee,
      projectedBill: bill.totalBill,
      savings: 0 // Will calculate against current plan
    });
  }

  // Sort by total cost
  recommendations.sort((a, b) => a.projectedBill - b.projectedBill);

  return recommendations;
}

/**
 * Format currency for display
 * @param {number} amount 
 * @returns {string} Formatted currency
 */
export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}