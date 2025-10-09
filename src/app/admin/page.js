'use client';

import { useState } from 'react';
import Navigation from '../../components/Navigation';

export default function AdminPage() {
  const [adminSecret, setAdminSecret] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const performAction = async (action) => {
    if (!adminSecret || !userEmail) {
      setMessage('❌ Please enter both admin secret and user email');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/admin/upgrade-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminSecret,
          userEmail,
          action
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(`✅ ${data.message}`);
      } else {
        setMessage(`❌ ${data.error}`);
      }
    } catch (error) {
      setMessage(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Admin Testing Panel</h1>
          
          <div className="card mb-8">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <h2 className="text-lg font-semibold text-yellow-800 mb-2">⚠️ Development Testing Only</h2>
              <p className="text-yellow-700 text-sm">
                This admin panel is for testing premium features during development. 
                Remove this in production!
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Admin Secret</label>
                <input
                  type="password"
                  value={adminSecret}
                  onChange={(e) => setAdminSecret(e.target.value)}
                  className="input-field"
                  placeholder="Enter admin secret key"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Default: snap2invoice-admin-test-key-2024
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">User Email</label>
                <input
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  className="input-field"
                  placeholder="user@example.com"
                />
              </div>
            </div>

            {message && (
              <div className={`p-3 rounded-lg mt-4 ${
                message.includes('✅') 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {message}
              </div>
            )}

            <div className="flex flex-wrap gap-4 mt-6">
              <button
                onClick={() => performAction('upgrade')}
                disabled={loading}
                className="btn-primary"
              >
                {loading ? 'Processing...' : '🚀 Upgrade to Premium'}
              </button>
              
              <button
                onClick={() => performAction('downgrade')}
                disabled={loading}
                className="btn-secondary"
              >
                {loading ? 'Processing...' : '⬇️ Downgrade to Free'}
              </button>
              
              <button
                onClick={() => performAction('reset-usage')}
                disabled={loading}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? 'Processing...' : '🔄 Reset Usage Count'}
              </button>
            </div>
          </div>

          <div className="card">
            <h2 className="text-xl font-semibold mb-4">How to Test Premium Features</h2>
            
            <div className="space-y-4 text-sm">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-800 mb-2">Step 1: Create a Test Account</h3>
                <p className="text-blue-700">
                  1. Go to <code>/auth</code> and sign up with a test email<br/>
                  2. Confirm your account if email verification is enabled
                </p>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-800 mb-2">Step 2: Upgrade to Premium</h3>
                <p className="text-blue-700">
                  1. Enter the admin secret: <code>snap2invoice-admin-test-key-2024</code><br/>
                  2. Enter the test user's email address<br/>
                  3. Click "Upgrade to Premium"
                </p>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-800 mb-2">Step 3: Test Premium Features</h3>
                <p className="text-blue-700">
                  • Upload unlimited receipts (no 3/month limit)<br/>
                  • Upload custom business logo in Account settings<br/>
                  • See "Premium Plan" badge in Account page
                </p>
              </div>
            </div>
          </div>

          <div className="card mt-6">
            <h2 className="text-xl font-semibold mb-4">Environment Variables</h2>
            <p className="text-sm text-gray-600 mb-2">
              You can customize the admin secret by setting the <code>ADMIN_SECRET</code> environment variable:
            </p>
            <div className="bg-gray-100 p-3 rounded text-sm font-mono">
              ADMIN_SECRET=your-custom-admin-key
            </div>
          </div>
        </div>
      </main>
    </>
  );
}