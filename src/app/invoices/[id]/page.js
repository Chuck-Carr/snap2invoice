'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import Navigation from '../../../components/Navigation';
import { supabase } from '../../supabaseClient';

export default function InvoiceEditPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const [invoice, setInvoice] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && params.id) {
      fetchInvoice();
    }
  }, [user, params.id]);

  const fetchInvoice = async () => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', params.id)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      // Parse items from JSON, ensuring it's always an array
      let parsedItems = [];
      try {
        if (typeof data.items === 'string') {
          parsedItems = JSON.parse(data.items) || [];
        } else if (Array.isArray(data.items)) {
          parsedItems = data.items;
        }
      } catch (parseError) {
        console.error('Failed to parse invoice items:', parseError);
        parsedItems = [];
      }
      
      const invoiceData = {
        ...data,
        items: parsedItems
      };
      
      console.log('Setting invoice with items:', {
        itemsType: typeof parsedItems,
        itemsIsArray: Array.isArray(parsedItems),
        itemsLength: parsedItems?.length,
        items: parsedItems
      });
      
      setInvoice(invoiceData);
    } catch (error) {
      console.error('Error fetching invoice:', error);
      setMessage('Invoice not found or access denied');
    }
  };

  const updateInvoice = async (updates) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('invoices')
        .update(updates)
        .eq('id', invoice.id)
        .eq('user_id', user.id);

      if (error) throw error;

      // Ensure items remain an array when updating
      setInvoice(prev => ({
        ...prev,
        ...updates,
        items: Array.isArray(prev.items) ? prev.items : []
      }));
      setMessage('✅ Invoice updated successfully');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error updating invoice:', error);
      setMessage('❌ Failed to update invoice');
    } finally {
      setSaving(false);
    }
  };

  const addItem = () => {
    console.log('addItem called - current items:', {
      itemsType: typeof invoice.items,
      itemsIsArray: Array.isArray(invoice.items),
      items: invoice.items
    });
    
    const newItem = {
      id: `item-${Date.now()}`,
      description: '',
      quantity: 1,
      rate: 0,
      amount: 0
    };
    
    const currentItems = Array.isArray(invoice.items) ? invoice.items : [];
    const updatedItems = [...currentItems, newItem];
    updateInvoiceItems(updatedItems);
  };

  const updateItem = (itemId, field, value) => {
    const currentItems = Array.isArray(invoice.items) ? invoice.items : [];
    const updatedItems = currentItems.map(item => {
      if (item.id === itemId) {
        const updated = { ...item, [field]: value };
        if (field === 'quantity' || field === 'rate') {
          updated.amount = updated.quantity * updated.rate;
        }
        return updated;
      }
      return item;
    });
    
    updateInvoiceItems(updatedItems);
  };

  const removeItem = (itemId) => {
    const currentItems = Array.isArray(invoice.items) ? invoice.items : [];
    const updatedItems = currentItems.filter(item => item.id !== itemId);
    updateInvoiceItems(updatedItems);
  };

  const updateInvoiceItems = (items) => {
    const subtotal = items.reduce((sum, item) => sum + (item.amount || 0), 0);
    const taxAmount = subtotal * (invoice.tax_rate / 100);
    const total = subtotal + taxAmount;

    const updates = {
      items: JSON.stringify(items),
      subtotal: subtotal.toFixed(2),
      tax_amount: taxAmount.toFixed(2),
      total_amount: total.toFixed(2)
    };

    setInvoice(prev => ({
      ...prev,
      items,
      subtotal: subtotal.toFixed(2),
      tax_amount: taxAmount.toFixed(2),
      total_amount: total.toFixed(2)
    }));

    // Auto-save
    updateInvoice(updates);
  };

  const generatePDF = async () => {
    // In a real app, you'd use a library like jsPDF or puppeteer
    // For now, we'll just show a preview
    window.print();
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return null;
  }

  if (!invoice) {
    return (
      <>
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Invoice Not Found</h1>
            <p className="text-gray-600 mb-4">
              {message || 'The invoice you are looking for does not exist or you do not have access to it.'}
            </p>
            <button
              onClick={() => router.push('/invoices')}
              className="btn-primary"
            >
              Back to Invoices
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navigation />
      <main className="container mx-auto px-4 py-4 sm:py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 space-y-4 sm:space-y-0">
            <h1 className="text-2xl sm:text-3xl font-bold">
              Edit Invoice #{invoice.invoice_number}
            </h1>
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
              <button
                onClick={generatePDF}
                className="btn-secondary text-sm sm:text-base w-full sm:w-auto"
              >
                📄 Preview/Print
              </button>
              <button
                onClick={() => router.push('/invoices')}
                className="btn-primary text-sm sm:text-base w-full sm:w-auto"
              >
                Back to Invoices
              </button>
            </div>
          </div>

          {message && (
            <div className={`p-4 rounded-lg mb-6 ${
              message.includes('✅') 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {message}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
            {/* Left Column - Invoice Details */}
            <div className="space-y-4 sm:space-y-6">
              <div className="card">
                <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Invoice Details</h2>
                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Issue Date</label>
                    <input
                      type="date"
                      value={invoice.issue_date || ''}
                      onChange={(e) => updateInvoice({ issue_date: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Due Date</label>
                    <input
                      type="date"
                      value={invoice.due_date || ''}
                      onChange={(e) => updateInvoice({ due_date: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Tax Rate (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={invoice.tax_rate || 0}
                      onChange={(e) => {
                        const taxRate = parseFloat(e.target.value) || 0;
                        updateInvoice({ tax_rate: taxRate });
                        const currentItems = Array.isArray(invoice.items) ? invoice.items : [];
                        updateInvoiceItems(currentItems);
                      }}
                      className="input-field"
                    />
                  </div>
                </div>
              </div>

              <div className="card">
                <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Client Information</h2>
                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Client Name</label>
                    <input
                      type="text"
                      value={invoice.client_name || ''}
                      onChange={(e) => updateInvoice({ client_name: e.target.value })}
                      className="input-field"
                      placeholder="Client or company name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Client Email</label>
                    <input
                      type="email"
                      value={invoice.client_email || ''}
                      onChange={(e) => updateInvoice({ client_email: e.target.value })}
                      className="input-field"
                      placeholder="client@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Client Address</label>
                    <textarea
                      value={invoice.client_address || ''}
                      onChange={(e) => updateInvoice({ client_address: e.target.value })}
                      className="input-field"
                      rows="3"
                      placeholder="Client address"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Items */}
            <div className="card">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 sm:mb-4 space-y-2 sm:space-y-0">
                <h2 className="text-lg sm:text-xl font-semibold">Invoice Items</h2>
                <button
                  onClick={addItem}
                  className="btn-primary text-sm w-full sm:w-auto"
                >
                  + Add Item
                </button>
              </div>

              <div className="space-y-3 sm:space-y-4">
                {Array.isArray(invoice.items) ? invoice.items.map((item, index) => (
                  <div key={item.id} className="border rounded-lg p-3 sm:p-4">
                    <div className="flex justify-between items-start mb-2 sm:mb-3">
                      <span className="text-sm font-medium">Item {index + 1}</span>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-red-600 hover:text-red-800 text-sm px-2 py-1"
                      >
                        Remove
                      </button>
                    </div>
                    
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={item.description || ''}
                        onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                        placeholder="Item description"
                        className="input-field text-sm w-full"
                      />
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-2">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Quantity</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.quantity || 0}
                            onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                            className="input-field text-sm w-full"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Rate ($)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.rate || 0}
                            onChange={(e) => updateItem(item.id, 'rate', parseFloat(e.target.value) || 0)}
                            className="input-field text-sm w-full"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Amount</label>
                          <div className="input-field text-sm bg-gray-50 font-medium">
                            ${(item.amount || 0).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No items found. Click "+ Add Item" to add your first item.</p>
                  </div>
                )}
              </div>

              {/* Totals */}
              <div className="border-t pt-3 sm:pt-4 mt-4 sm:mt-6">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="font-medium">${(parseFloat(invoice.subtotal) || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax ({invoice.tax_rate || 0}%):</span>
                    <span className="font-medium">${(parseFloat(invoice.tax_amount) || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-base sm:text-lg border-t pt-2 mt-2">
                    <span>Total:</span>
                    <span>${(parseFloat(invoice.total_amount) || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="card mt-6 sm:mt-8">
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Notes</h2>
            <textarea
              value={invoice.notes || ''}
              onChange={(e) => updateInvoice({ notes: e.target.value })}
              className="input-field w-full"
              rows="3"
              placeholder="Add any additional notes or terms..."
            />
          </div>
        </div>
      </main>
    </>
  );
}