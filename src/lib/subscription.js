/**
 * Utility functions for subscription and premium access management
 */

/**
 * Check if a user has premium access based on their subscription status
 * Handles the case where subscription is cancelled but still active until expiry
 */
export function hasValidPremiumAccess(profile) {
  if (!profile) return false;
  
  // If explicitly marked as premium and no expiry date, assume active
  if (profile.subscription_plan === 'premium' && !profile.subscription_expires_at) {
    return true;
  }
  
  // If explicitly marked as free, no premium access
  if (profile.subscription_plan === 'free') {
    return false;
  }
  
  // If subscription_plan is premium and we have an expiry date, check if still valid
  if (profile.subscription_plan === 'premium' && profile.subscription_expires_at) {
    const expiryDate = new Date(profile.subscription_expires_at);
    const now = new Date();
    return now < expiryDate;
  }
  
  return false;
}

/**
 * Check if a user is within their free plan limits for the current month
 */
export function isWithinFreePlanLimits(profile) {
  if (!profile) {
    return true; // If no profile data, allow access (avoid blocking user)
  }
  
  if (hasValidPremiumAccess(profile)) {
    return true; // Premium users have unlimited access
  }
  
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
  const isCurrentMonth = profile.month_year === currentMonth;
  const invoicesThisMonth = isCurrentMonth ? (profile.invoices_this_month || 0) : 0;
  
  return invoicesThisMonth < 3; // Free plan limit is 3 invoices per month
}

/**
 * Get subscription status display information
 */
export function getSubscriptionStatus(profile) {
  if (!profile) {
    return { status: 'unknown', isActive: false, isPremium: false };
  }
  
  const isPremium = hasValidPremiumAccess(profile);
  const isCancelled = profile.subscription_cancelled_at && !profile.subscription_expires_at;
  const willExpire = profile.subscription_cancelled_at && profile.subscription_expires_at;
  
  if (isPremium) {
    if (willExpire) {
      return {
        status: 'cancelled_active',
        isActive: true,
        isPremium: true,
        message: 'Premium (Cancelled - expires ' + new Date(profile.subscription_expires_at).toLocaleDateString() + ')'
      };
    }
    return {
      status: 'active',
      isActive: true,
      isPremium: true,
      message: 'Premium'
    };
  }
  
  return {
    status: 'free',
    isActive: false,
    isPremium: false,
    message: 'Free'
  };
}