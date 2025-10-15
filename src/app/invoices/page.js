'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../contexts/AuthContext';
import Navigation from '../../components/Navigation';
import { supabase } from '../supabaseClient';
import { hasValidPremiumAccess, isWithinFreePlanLimits } from '../../lib/subscription';

export default function InvoicesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [invoices, setInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      fetchInvoices();
      fetchUserProfile();
    }
  }, [user]);

  const fetchUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('subscription_plan, subscription_expires_at, subscription_cancelled_at, invoices_this_month, month_year')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setUserProfile(data);
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const fetchInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvoices(data);
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const deleteInvoice = async (invoiceId) => {
    if (!confirm('Are you sure you want to delete this invoice?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoiceId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Update local state
      setInvoices(prev => prev.filter(invoice => invoice.id !== invoiceId));
      
      // Note: In a real app, you might want to decrement the user's invoice count
      // when deleting invoices, but this depends on your business logic
    } catch (error) {
      console.error('Error deleting invoice:', error);
      alert('Failed to delete invoice');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'sent':
        return 'bg-blue-100 text-blue-800';
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const updateInvoiceStatus = async (invoiceId, newStatus) => {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ status: newStatus })
        .eq('id', invoiceId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Update local state
      setInvoices(prev => 
        prev.map(invoice => 
          invoice.id === invoiceId 
            ? { ...invoice, status: newStatus }
            : invoice
        )
      );
    } catch (error) {
      console.error('Error updating invoice status:', error);
      alert('Failed to update invoice status');
    }
  };

  if (loading || loadingInvoices) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const currentMonth = new Date().toISOString().slice(0, 7);
  const isPremium = hasValidPremiumAccess(userProfile);
  const monthlyUsage = userProfile?.month_year === currentMonth ? userProfile?.invoices_this_month : 0;
  const canCreateMore = isWithinFreePlanLimits(userProfile);

  return (
    <>
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Your Invoices</h1>
            {!isPremium && (
              <p className="text-gray-600">
                Free plan: {monthlyUsage}/3 invoices this month
                {!canCreateMore && (
                  <span className="text-red-600 ml-2">Limit reached</span>
                )}
              </p>
            )}
          </div>
          
          <div className="flex space-x-4">
            {!canCreateMore && (
              <div className="text-center">
                <p className="text-sm text-red-600 mb-2">Monthly limit reached</p>
                <Link href="/account" className="btn-secondary text-sm">
                  Upgrade to Premium
                </Link>
              </div>
            )}
            <Link 
              href="/receipts" 
              className={`btn-primary ${!canCreateMore ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={(e) => {
                if (!canCreateMore) {
                  e.preventDefault();
                  alert('You have reached your monthly limit. Please upgrade to premium for unlimited invoices.');
                }
              }}
            >
              + Upload Receipt
            </Link>
          </div>
        </div>

        {invoices.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📄</div>
            <h2 className="text-2xl font-semibold mb-2">No invoices yet</h2>
            <p className="text-gray-600 mb-6">
              Upload a receipt to create your first invoice
            </p>
            <Link href="/receipts" className="btn-primary">
              Upload Receipt
            </Link>
          </div>
        ) : (
          <div className="grid gap-6">
            {invoices.map((invoice) => (
              <div key={invoice.id} className="card">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-4 mb-2">
                      <h3 className="text-lg font-semibold">
                        #{invoice.invoice_number}
                      </h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                        {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">Client:</span>
                        <div>{invoice.client_name || 'No client name'}</div>
                      </div>
                      <div>
                        <span className="font-medium">Amount:</span>
                        <div className="text-green-600 font-semibold">
                          ${parseFloat(invoice.total_amount || 0).toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium">Issue Date:</span>
                        <div>{invoice.issue_date || 'Not set'}</div>
                      </div>
                      <div>
                        <span className="font-medium">Due Date:</span>
                        <div>{invoice.due_date || 'Not set'}</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    {/* Status Dropdown */}
                    <select
                      value={invoice.status}
                      onChange={(e) => updateInvoiceStatus(invoice.id, e.target.value)}
                      className="text-sm border rounded px-2 py-1"
                    >
                      <option value="draft">Draft</option>
                      <option value="sent">Sent</option>
                      <option value="paid">Paid</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                    
                    <Link 
                      href={`/invoices/${invoice.id}`}
                      className="btn-primary text-sm"
                    >
                      Edit
                    </Link>
                    
                    <button
                      onClick={() => deleteInvoice(invoice.id)}
                      className="text-red-600 hover:text-red-800 text-sm px-2 py-1"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}