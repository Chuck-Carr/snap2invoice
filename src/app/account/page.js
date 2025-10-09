'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import Navigation from '../../components/Navigation';
import { supabase } from '../supabaseClient';

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

  const fetchProfile = async () => {
    try {
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
    if (!logoFile || profile.subscription_plan !== 'premium') {
      return;
    }

    setUploading(true);
    try {
      const fileExt = logoFile.name.split('.').pop();
      const fileName = `${user.id}/logo.${fileExt}`;
      const filePath = `logos/${fileName}`;

      // Upload file
      const { error: uploadError } = await supabase.storage
        .from('receipts') // Using same bucket for simplicity
        .upload(filePath, logoFile, { 
          contentType: logoFile.type,
          upsert: true // Replace existing logo
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: publicUrl } = supabase.storage
        .from('receipts')
        .getPublicUrl(filePath);

      // Update profile with logo URL
      await updateProfile({ logo_url: publicUrl.publicUrl });
      setLogoFile(null);
      setMessage('✅ Logo uploaded successfully');
    } catch (error) {
      console.error('Error uploading logo:', error);
      setMessage('❌ Failed to upload logo');
    } finally {
      setUploading(false);
    }
  };

  const upgradeToPremium = async () => {
    // In a real app, this would integrate with a payment processor like Stripe
    // For demo purposes, we'll just update the subscription
    try {
      await updateProfile({ 
        subscription_plan: 'premium',
        subscription_expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year from now
      });
      setMessage('🎉 Upgraded to Premium! You now have unlimited invoices and custom branding.');
    } catch (error) {
      setMessage('❌ Failed to upgrade. Please try again.');
    }
  };

  const testUpgradeToPremium = async () => {
    // Development testing upgrade using admin API
    try {
      const response = await fetch('/api/admin/upgrade-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminSecret: 'snap2invoice-admin-test-key-2024',
          userEmail: user.email,
          action: 'upgrade'
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        // Refresh profile data
        await fetchProfile();
        setMessage('🎉 Upgraded to Premium for testing! You now have unlimited invoices and custom branding.');
      } else {
        setMessage('❌ Failed to upgrade: ' + data.error);
      }
    } catch (error) {
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

  const cancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your premium subscription?')) {
      return;
    }

    try {
      await updateProfile({ 
        subscription_plan: 'free',
        subscription_expires_at: null,
        logo_url: null // Remove custom logo
      });
      setMessage('⚠️ Downgraded to free plan. Your custom logo has been removed.');
    } catch (error) {
      setMessage('❌ Failed to cancel subscription. Please try again.');
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

  const currentMonth = new Date().toISOString().slice(0, 7);
  const isFreePlan = profile.subscription_plan === 'free';
  const monthlyUsage = profile.month_year === currentMonth ? profile.invoices_this_month : 0;

  return (
    <>
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Account Settings</h1>

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

          {/* Subscription Status */}
          <div className="card mb-8">
            <h2 className="text-xl font-semibold mb-4">Subscription</h2>
            
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    isFreePlan 
                      ? 'bg-gray-100 text-gray-800' 
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {isFreePlan ? 'Free Plan' : 'Premium Plan'}
                  </span>
                  {!isFreePlan && profile.subscription_expires_at && (
                    <span className="text-sm text-gray-600">
                      Expires: {new Date(profile.subscription_expires_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
                
                {isFreePlan && (
                  <p className="text-sm text-gray-600 mt-2">
                    {monthlyUsage}/3 invoices used this month
                  </p>
                )}
              </div>
              
              {isFreePlan ? (
                <div className="flex flex-col space-y-2">
                  <button 
                    onClick={upgradeToPremium}
                    className="btn-primary"
                  >
                    Upgrade to Premium
                  </button>
                  <button 
                    onClick={testUpgradeToPremium}
                    className="text-xs bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600"
                    title="Development testing only"
                  >
                    🧪 Test Upgrade (Dev Only)
                  </button>
                </div>
              ) : (
                <button 
                  onClick={cancelSubscription}
                  className="btn-secondary"
                >
                  Cancel Subscription
                </button>
              )}
            </div>

            {/* Plan Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-2">Free Plan</h3>
                <ul className="text-sm space-y-1 text-gray-600">
                  <li>✅ 3 invoices per month</li>
                  <li>✅ OCR receipt processing</li>
                  <li>✅ Basic invoice editing</li>
                  <li>❌ Custom branding</li>
                  <li>❌ Unlimited invoices</li>
                </ul>
              </div>
              
              <div className="border-2 border-blue-500 rounded-lg p-4">
                <h3 className="font-semibold mb-2 text-blue-600">Premium Plan</h3>
                <ul className="text-sm space-y-1 text-gray-600">
                  <li>✅ Unlimited invoices</li>
                  <li>✅ OCR receipt processing</li>
                  <li>✅ Advanced invoice editing</li>
                  <li>✅ Custom business logo</li>
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

          {/* Custom Logo - Premium Only */}
          {!isFreePlan && (
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
                    Recommended: PNG or JPG, max 2MB, square aspect ratio
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
                    
                    <div className="flex space-x-3">
                      <button
                        type="submit"
                        disabled={passwordLoading}
                        className="btn-primary"
                      >
                        {passwordLoading ? 'Updating...' : 'Update Password'}
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => {
                          setShowPasswordForm(false);
                          setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                        }}
                        className="btn-secondary"
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
                          Type "DELETE MY ACCOUNT" to confirm:
                        </label>
                        <input
                          type="text"
                          value={deleteConfirmText}
                          onChange={(e) => setDeleteConfirmText(e.target.value)}
                          className="input-field border-red-300 focus:ring-red-500 focus:border-red-500"
                          placeholder="DELETE MY ACCOUNT"
                        />
                      </div>
                      
                      <div className="flex space-x-3">
                        <button
                          onClick={deleteAccount}
                          disabled={deletingAccount || deleteConfirmText !== 'DELETE MY ACCOUNT'}
                          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {deletingAccount ? 'Deleting...' : '🗑️ Permanently Delete Account'}
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => {
                            setShowDeleteConfirm(false);
                            setDeleteConfirmText('');
                          }}
                          className="btn-secondary"
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