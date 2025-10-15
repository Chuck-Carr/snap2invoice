'use client';

import { forwardRef } from 'react';
import { hasValidPremiumAccess } from '../lib/subscription';

const InvoiceTemplate = forwardRef(({ invoice, profile }, ref) => {
  const isPremium = hasValidPremiumAccess(profile);
  const hasLogo = isPremium && profile?.logo_url;
  
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(parseFloat(amount) || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });
  };

  const items = Array.isArray(invoice.items) ? invoice.items : [];

  return (
    <div ref={ref} className="invoice-template bg-white font-sans text-gray-900 max-w-4xl mx-auto" style={{ fontFamily: 'Arial, sans-serif' }}>
      {/* Header Section */}
      <div className="px-8 py-6 border-b border-gray-200 flex justify-between items-start">
        <div className="flex-1">
          {hasLogo && (
            <img
              src={profile.logo_url}
              alt="Business Logo"
              className="w-16 h-16 object-contain mb-4"
            />
          )}
          <div className="text-gray-800">
            <div className="font-semibold text-xl text-blue-600">{profile?.business_name || 'Your company name'}</div>
            {profile?.business_address ? (
              <div className="text-sm mt-2 text-gray-600 whitespace-pre-line">{profile.business_address}</div>
            ) : (
              <div className="text-sm mt-2 text-gray-600">
                <div>Your street address</div>
                <div>City, Province Postal code</div>
              </div>
            )}
            {profile?.business_phone && (
              <div className="text-sm text-gray-600">{profile.business_phone}</div>
            )}
            {profile?.business_email ? (
              <div className="text-sm text-gray-600">{profile.business_email}</div>
            ) : (
              <div className="text-sm text-gray-600">youremail@domain.com</div>
            )}
          </div>
        </div>
        
        <div className="text-right">
          <h1 className="text-5xl font-bold text-gray-800">Invoice</h1>
        </div>
      </div>

      {/* Invoice Details and Bill To Section */}
      <div className="px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Bill To */}
          <div>
            <div className="font-bold text-gray-800 mb-2">Invoice to</div>
            <div className="text-sm text-gray-700">
              <div>{invoice.client_name || 'Street address'}</div>
              {invoice.client_address ? (
                <div className="whitespace-pre-line">{invoice.client_address}</div>
              ) : (
                <div>City, Province, Postal code</div>
              )}
            </div>
          </div>
          
          {/* Invoice Details */}
          <div className="text-right">
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <span className="font-semibold text-gray-800">Invoice #</span>
                <span className="text-gray-700">{invoice.invoice_number || 'Invoice # 00/00/0000'}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <span className="font-semibold text-gray-800">Date</span>
                <span className="text-gray-700">{formatDate(invoice.issue_date) || '00/00/0000'}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <span className="font-semibold text-gray-800">Due Date</span>
                <span className="text-gray-700">{formatDate(invoice.due_date) || 'Terms'}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <span className="font-semibold text-gray-800">Terms</span>
                <span className="text-gray-700"></span>
              </div>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="mb-8">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="text-left py-3 font-bold text-gray-800 w-1/2">Description</th>
                <th className="text-center py-3 font-bold text-gray-800 w-16">Qty</th>
                <th className="text-right py-3 font-bold text-gray-800 w-20">Rate</th>
                <th className="text-right py-3 font-bold text-gray-800 w-24">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.length > 0 ? items.map((item, index) => (
                <tr key={item.id || index} className="border-b border-gray-200">
                  <td className="py-4 pr-4">
                    <div className="font-semibold text-gray-800">{item.description || 'Item name'}</div>
                    <div className="text-sm text-gray-600">Description of item</div>
                  </td>
                  <td className="py-4 text-center text-gray-700">{item.quantity || 0}</td>
                  <td className="py-4 text-right text-gray-700">{formatCurrency(item.rate)}</td>
                  <td className="py-4 text-right text-gray-700 font-semibold">{formatCurrency(item.amount)}</td>
                </tr>
              )) : (
                // Show placeholder rows when no items
                Array.from({ length: 4 }, (_, index) => (
                  <tr key={index} className="border-b border-gray-200">
                    <td className="py-4 pr-4">
                      <div className="font-semibold text-gray-400">Item name</div>
                      <div className="text-sm text-gray-400">Description of item</div>
                    </td>
                    <td className="py-4 text-center text-gray-400">0</td>
                    <td className="py-4 text-right text-gray-400">$0.00</td>
                    <td className="py-4 text-right text-gray-400 font-semibold">$0.00</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Message and Totals Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
          {/* Message Section */}
          <div>
            <div className="font-bold text-gray-800 mb-2">Message</div>
            {invoice.notes && (
              <div className="text-sm text-gray-700 whitespace-pre-line">
                {invoice.notes}
              </div>
            )}
          </div>
          
          {/* Totals Section */}
          <div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1">
                <span className="font-bold text-gray-800">Subtotal</span>
                <span className="text-gray-700 font-semibold">{formatCurrency(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="font-bold text-gray-800">Discount</span>
                <span className="text-gray-700 font-semibold">$0.00</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="font-bold text-gray-800">Tax</span>
                <span className="text-gray-700 font-semibold">{formatCurrency(invoice.tax_amount)}</span>
              </div>
              <div className="flex justify-between py-2 border-t border-gray-300">
                <span className="font-bold text-gray-800">Total</span>
                <span className="text-gray-800 font-bold">{formatCurrency(invoice.total_amount)}</span>
              </div>
              <div className="flex justify-between py-2 mt-4">
                <span className="font-bold text-xl text-gray-800">Balance Due</span>
                <span className="text-gray-800 font-bold text-xl">{formatCurrency(invoice.total_amount)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      {!isPremium && (
        <div className="mt-12 pt-6 border-t border-gray-200 text-center text-xs text-gray-400">
          <p>Generated with Snap2Invoice</p>
        </div>
      )}

      {/* Print-specific styles */}
      <style jsx>{`
        @media print {
          .invoice-template {
            margin: 0;
            padding: 0;
            font-size: 12px;
            max-width: none;
            width: 100%;
            background: white !important;
          }
          
          .invoice-template * {
            color: black !important;
          }
          
          .bg-green-500 {
            background-color: #10b981 !important;
            -webkit-print-color-adjust: exact;
            color-adjust: exact;
          }
          
          .invoice-template table {
            page-break-inside: avoid;
          }
          
          .invoice-template tr {
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
});

InvoiceTemplate.displayName = 'InvoiceTemplate';

export default InvoiceTemplate;