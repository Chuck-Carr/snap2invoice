'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import Navigation from '../../components/Navigation';
import { supabase } from '../supabaseClient';
import { hasValidPremiumAccess, getSubscriptionStatus } from '../../lib/subscription';

export default function AccountPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  // Handle Stripe checkout success/cancel
  useEffect(() => {
    // Only handle URL params if user is loaded
    if (!user || loading) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const canceled = urlParams.get('canceled');
    const plan = urlParams.get('plan');
    
    if (success === 'true' && plan) {
      setMessage(`🎉 Successfully subscribed to ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan! Your subscription is now active.`);
      // Clear URL parameters
      window.history.replaceState({}, '', window.location.pathname);
      // Refresh profile to show new subscription
      setTimeout(() => {
        fetchProfile();
      }, 2000);
    } else if (canceled === 'true') {
      setMessage('⚠️ Checkout was canceled. Your subscription was not changed.');
      // Clear URL parameters
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [user, loading]);

  const fetchProfile = async () => {
    // Early return if user is not available yet
    if (!user || !user.id) {
      console.log('User not available yet, skipping fetchProfile');
      return;
    }
    
    try {
      // Get user's access token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      // Try new pay-per-use system first
      const response = await fetch('/api/usage/analytics', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const usageData = await response.json();
        setProfile({
          id: user.id,
          email: user.email,
          subscription_plan: usageData.subscription.planId,
          plan_details: usageData.subscription.planDetails,
          usage: usageData.currentMonth,
          // Set premium access based on plan
          subscription_expires_at: null,
          subscription_cancelled_at: null
        });
        return;
      }
      
      // Fallback to old system if new system not available
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        // Profile might not exist - try to create it
        await fixUserProfile();
        return;
      }
      
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
      setMessage('Error loading profile. Please try again.');
    }
  };
  
  const fixUserProfile = async () => {
    try {
      // Get user's access token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('Authentication token not found');
      }

      // Call the fix-profile API
      setMessage('Creating your profile...');
      const response = await fetch('/api/fix-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({})
      });

      const data = await response.json();

      if (response.ok && data.profile) {
        setProfile(data.profile);
        setMessage('✅ Profile created successfully!');
      } else {
        throw new Error(data.error || 'Failed to create profile');
      }
    } catch (error) {
      console.error('Error fixing profile:', error);
      setMessage('❌ Unable to create profile. Please try signing out and in again.');
    }
  };

  const updateProfile = async (updates) => {
    if (!user || !user.id) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;

      setProfile(prev => ({ ...prev, ...updates }));
      setMessage('✅ Profile updated successfully');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage('❌ Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async () => {
    if (!logoFile || !hasValidPremiumAccess(profile)) {
      return;
    }

    // Client-side validation
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (logoFile.size > maxSize) {
      setMessage('❌ File too large. Please choose an image under 5MB.');
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(logoFile.type)) {
      setMessage('❌ Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.');
      return;
    }

    setUploading(true);
    setMessage('📤 Uploading logo...');
    try {
      // Get user's access token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('Authentication token not found');
      }

      // Create form data
      const formData = new FormData();
      formData.append('logo', logoFile);

      // Upload via API endpoint
      const response = await fetch('/api/upload-logo', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Update local profile state
        setProfile(prev => ({ ...prev, logo_url: data.logoUrl }));
        setLogoFile(null);
        setMessage('✅ Logo uploaded successfully');
      } else {
        throw new Error(data.error || 'Failed to upload logo');
      }
    } catch (error) {
      console.error('Error uploading logo:', error);
      setMessage('❌ Failed to upload logo: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const upgradeToPlan = async (planId) => {
    try {
      // For free plan, use direct downgrade
      if (planId.toLowerCase() === 'free') {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        if (!token) {
          throw new Error('Authentication token not found');
        }

        const response = await fetch('/api/usage/plan', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ planId }),
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
          setMessage(`✅ Successfully downgraded to ${data.newPlan.name} plan!`);
          await fetchProfile();
        } else {
          setMessage('❌ Failed to downgrade plan: ' + data.error);
        }
        return;
      }

      // For paid plans, use Stripe checkout
      setMessage('🔄 Redirecting to secure checkout...');
      
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await fetch('/api/create-subscription-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          planId,
          successUrl: `${window.location.origin}/account?success=true&plan=${planId}`,
          cancelUrl: `${window.location.origin}/account?canceled=true`
        }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.url) {
        // Redirect to Stripe checkout
        window.location.href = data.url;
      } else {
        setMessage('❌ Failed to create checkout session: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error upgrading plan:', error);
      setMessage('❌ Failed to upgrade. Please try again.');
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMessage('❌ New passwords do not match');
      return;
    }
    
    if (passwordForm.newPassword.length < 6) {
      setMessage('❌ New password must be at least 6 characters');
      return;
    }

    setPasswordLoading(true);
    setMessage('');

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword
      });

      if (error) throw error;

      setMessage('✅ Password updated successfully');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPasswordForm(false);
      setTimeout(() => setMessage(''), 5000);
    } catch (error) {
      console.error('Error updating password:', error);
      setMessage('❌ Failed to update password: ' + error.message);
    } finally {
      setPasswordLoading(false);
    }
  };

  const deleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE MY ACCOUNT') {
      setMessage('❌ Please type "DELETE MY ACCOUNT" to confirm');
      return;
    }

    setDeletingAccount(true);
    setMessage('');

    try {
      // Get user's access token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('Authentication token not found. Please sign in again.');
      }

      // Call secure deletion API
      const response = await fetch('/api/account/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          confirmationText: deleteConfirmText
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('✅ Account deleted successfully. Redirecting...');
        
        // Redirect to home page
        setTimeout(() => {
          router.push('/');
        }, 2000);
      } else {
        setMessage('❌ Failed to delete account: ' + data.error);
      }
      
    } catch (error) {
      console.error('Error deleting account:', error);
      setMessage('❌ Failed to delete account: ' + error.message);
    } finally {
      setDeletingAccount(false);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!user || !profile) {
    return null;
  }

  return (
    <>
      <Navigation />
      <main className="container mx-auto px-4 py-6 sm:py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8">Account Settings</h1>

          {message && (
            <div className={`p-4 rounded-lg mb-6 ${
              message.includes('✅') || message.includes('🎉') 
                ? 'bg-green-100 text-green-800' 
                : message.includes('⚠️')
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-red-100 text-red-800'
            }`}>
              {message}
            </div>
          )}

          {/* Pay-Per-Use Subscription Status */}
          <div className="card mb-8">
            <h2 className="text-xl font-semibold mb-4">Pay-Per-Use Plan</h2>
            
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    profile.subscription_plan === 'free'
                      ? 'bg-gray-100 text-gray-800' 
                      : profile.subscription_plan === 'starter'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-purple-100 text-purple-800'
                  }`}>
                    {profile.plan_details?.name || profile.subscription_plan.charAt(0).toUpperCase() + profile.subscription_plan.slice(1)} Plan
                  </span>
                </div>
                
                {profile.usage && (
                  <div className="text-sm text-gray-600 mt-2">
                    <p>{profile.usage.receiptsProcessed} receipts used this month</p>
                    {profile.usage.remainingReceipts > 0 && (
                      <p>{profile.usage.remainingReceipts} receipts remaining</p>
                    )}
                    {profile.usage.projectedBill && (
                      <p className="font-medium">Current bill: {profile.usage.projectedBill}</p>
                    )}
                  </div>
                )}
              </div>
              
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                {profile.subscription_plan === 'free' && (
                  <>
                    <button 
                      onClick={() => upgradeToPlan('starter')}
                      className="btn-primary text-sm"
                    >
                      💳 Subscribe to Starter
                    </button>
                    <button 
                      onClick={() => upgradeToPlan('pro')}
                      className="btn-secondary text-sm"
                    >
                      💳 Subscribe to Pro
                    </button>
                  </>
                )}
                {profile.subscription_plan === 'starter' && (
                  <>
                    <button 
                      onClick={() => upgradeToPlan('pro')}
                      className="btn-primary text-sm"
                    >
                      Upgrade to Pro
                    </button>
                    <button 
                      onClick={() => upgradeToPlan('free')}
                      className="btn-secondary text-sm"
                    >
                      Downgrade to Free
                    </button>
                  </>
                )}
                {profile.subscription_plan === 'pro' && (
                  <>
                    <button 
                      onClick={() => upgradeToPlan('starter')}
                      className="btn-secondary text-sm"
                    >
                      Downgrade to Starter
                    </button>
                    <button 
                      onClick={() => upgradeToPlan('free')}
                      className="btn-secondary text-sm"
                    >
                      Downgrade to Free
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Plan Comparison */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
              <div className={`border rounded-lg p-4 ${
                profile.subscription_plan === 'free' ? 'border-2 border-gray-400' : 'border-gray-200'
              }`}>
                <h3 className="font-semibold mb-2">Free Plan</h3>
                <p className="text-lg font-bold mb-2">$0/month</p>
                <ul className="text-sm space-y-1 text-gray-600">
                  <li>✅ 3 receipts per month</li>
                  <li>✅ OCR processing</li>
                  <li>✅ Basic editing</li>
                  <li>❌ Custom branding</li>
                </ul>
              </div>
              
              <div className={`border rounded-lg p-4 ${
                profile.subscription_plan === 'starter' ? 'border-2 border-blue-400' : 'border-gray-200'
              }`}>
                <h3 className="font-semibold mb-2 text-blue-600">Starter Plan</h3>
                <p className="text-lg font-bold mb-2">$9.99/month</p>
                <ul className="text-sm space-y-1 text-gray-600">
                  <li>✅ 15 receipts included</li>
                  <li>✅ $0.50 per extra receipt</li>
                  <li>✅ OCR processing</li>
                  <li>✅ Custom branding</li>
                </ul>
              </div>
              
              <div className={`border rounded-lg p-4 ${
                profile.subscription_plan === 'pro' ? 'border-2 border-purple-400' : 'border-gray-200'
              }`}>
                <h3 className="font-semibold mb-2 text-purple-600">Pro Plan</h3>
                <p className="text-lg font-bold mb-2">$24.99/month</p>
                <ul className="text-sm space-y-1 text-gray-600">
                  <li>✅ 50 receipts included</li>
                  <li>✅ $0.25 per extra receipt</li>
                  <li>✅ OCR processing</li>
                  <li>✅ Custom branding</li>
                  <li>✅ Priority support</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Business Information */}
          <div className="card mb-8">
            <h2 className="text-xl font-semibold mb-4">Business Information</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Business Name</label>
                <input
                  type="text"
                  value={profile.business_name || ''}
                  onChange={(e) => setProfile(prev => ({ ...prev, business_name: e.target.value }))}
                  className="input-field"
                  placeholder="Your business name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Business Email</label>
                <input
                  type="email"
                  value={profile.business_email || ''}
                  onChange={(e) => setProfile(prev => ({ ...prev, business_email: e.target.value }))}
                  className="input-field"
                  placeholder="business@example.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Business Phone</label>
                <input
                  type="tel"
                  value={profile.business_phone || ''}
                  onChange={(e) => setProfile(prev => ({ ...prev, business_phone: e.target.value }))}
                  className="input-field"
                  placeholder="(555) 123-4567"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Business Address</label>
                <textarea
                  value={profile.business_address || ''}
                  onChange={(e) => setProfile(prev => ({ ...prev, business_address: e.target.value }))}
                  className="input-field"
                  rows="3"
                  placeholder="123 Business St, City, State 12345"
                />
              </div>
            </div>
            
            <div className="mt-6">
              <button
                onClick={() => updateProfile({
                  business_name: profile.business_name,
                  business_email: profile.business_email,
                  business_phone: profile.business_phone,
                  business_address: profile.business_address
                })}
                disabled={saving}
                className="btn-primary"
              >
                {saving ? 'Saving...' : 'Save Business Info'}
              </button>
            </div>
          </div>

          {/* Custom Logo - Available for Starter and Pro plans */}
          {(profile.subscription_plan === 'starter' || profile.subscription_plan === 'pro') && (
            <div className="card mb-8">
              <h2 className="text-xl font-semibold mb-4">Custom Logo</h2>
              
              {profile.logo_url && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">Current logo:</p>
                  <img 
                    src={profile.logo_url} 
                    alt="Business logo" 
                    className="max-w-32 max-h-32 object-contain border rounded"
                  />
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Upload New Logo</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setLogoFile(e.target.files[0])}
                    className="input-field"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Recommended: PNG or JPG, max 5MB, square aspect ratio for best results
                  </p>
                </div>
                
                {logoFile && (
                  <button
                    onClick={uploadLogo}
                    disabled={uploading}
                    className="btn-primary"
                  >
                    {uploading ? 'Uploading...' : 'Upload Logo'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Account Management */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Account Management</h2>
            
            <div className="space-y-6">
              {/* Account Info */}
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b">
                  <div>
                    <span className="font-medium text-gray-700">Email Address:</span>
                    <div className="text-gray-900 font-medium">{user.email}</div>
                  </div>
                </div>
                
                <div className="flex justify-between items-center py-3 border-b">
                  <div>
                    <span className="font-medium text-gray-700">Member Since:</span>
                    <div className="text-gray-600">
                      {new Date(profile.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-between items-center py-3 border-b">
                  <div>
                    <span className="font-medium text-gray-700">Account Status:</span>
                    <div className="text-green-600 font-medium">Active</div>
                  </div>
                </div>
              </div>

              {/* Password Management */}
              <div className="pt-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium">Security</h3>
                </div>
                
                {!showPasswordForm ? (
                  <button
                    onClick={() => setShowPasswordForm(true)}
                    className="btn-secondary"
                  >
                    🔒 Change Password
                  </button>
                ) : (
                  <form onSubmit={changePassword} className="space-y-4 bg-gray-50 p-4 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium mb-1">New Password</label>
                      <input
                        type="password"
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                        className="input-field"
                        placeholder="Enter new password"
                        required
                        minLength={6}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-1">Confirm New Password</label>
                      <input
                        type="password"
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        className="input-field"
                        placeholder="Confirm new password"
                        required
                      />
                    </div>
                    
                    <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                      <button
                        type="submit"
                        disabled={passwordLoading}
                        className="btn-primary w-full sm:w-auto"
                      >
                        {passwordLoading ? 'Updating...' : 'Update Password'}
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => {
                          setShowPasswordForm(false);
                          setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                        }}
                        className="btn-secondary w-full sm:w-auto"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Danger Zone */}
              <div className="pt-6 border-t border-red-200">
                <div className="bg-red-50 p-4 rounded-lg">
                  <h3 className="text-lg font-medium text-red-800 mb-2">⚠️ Danger Zone</h3>
                  <p className="text-sm text-red-700 mb-4">
                    Once you delete your account, there is no going back. This will permanently delete your account, 
                    all your invoices, receipts, and associated data.
                  </p>
                  
                  {!showDeleteConfirm ? (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 text-sm"
                    >
                      🗑️ Delete Account
                    </button>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-red-800 mb-2">
                          Type &quot;DELETE MY ACCOUNT&quot; to confirm:
                        </label>
                        <input
                          type="text"
                          value={deleteConfirmText}
                          onChange={(e) => setDeleteConfirmText(e.target.value)}
                          className="input-field border-red-300 focus:ring-red-500 focus:border-red-500"
                          placeholder="DELETE MY ACCOUNT"
                        />
                      </div>
                      
                      <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                        <button
                          onClick={deleteAccount}
                          disabled={deletingAccount || deleteConfirmText !== 'DELETE MY ACCOUNT'}
                          className="bg-red-600 text-white px-4 py-3 md:py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] flex items-center justify-center w-full sm:w-auto"
                        >
                          {deletingAccount ? 'Deleting...' : '🗑️ Permanently Delete Account'}
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => {
                            setShowDeleteConfirm(false);
                            setDeleteConfirmText('');
                          }}
                          className="btn-secondary w-full sm:w-auto"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}