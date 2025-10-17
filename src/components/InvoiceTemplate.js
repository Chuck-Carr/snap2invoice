'use client';

import { forwardRef } from 'react';
import { hasValidPremiumAccess } from '../lib/subscription';

const InvoiceTemplate = forwardRef(({ invoice, profile, isMobilePreview = false }, ref) => {
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
    <div 
      ref={ref} 
      className={`invoice-template bg-white font-sans text-gray-900 ${
        isMobilePreview ? 'w-full' : 'max-w-4xl mx-auto'
      }`} 
      style={{ fontFamily: 'Arial, sans-serif' }}
    >
      {/* Header Section */}
      <div className={`${
        isMobilePreview ? 'px-4 py-4' : 'px-8 py-6'
      } border-b border-gray-200 flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-4 sm:space-y-0`}>
        <div className="flex-1">
          {hasLogo && (
            <img
              src={profile.logo_url}
              alt="Business Logo"
              className={`${isMobilePreview ? 'w-12 h-12' : 'w-16 h-16'} object-contain mb-3 sm:mb-4`}
            />
          )}
          <div className="text-gray-800">
            <div className={`font-semibold ${isMobilePreview ? 'text-lg' : 'text-xl'} text-blue-600`}>
              {profile?.business_name || 'Your company name'}
            </div>
            {profile?.business_address ? (
              <div className={`${isMobilePreview ? 'text-xs' : 'text-sm'} mt-2 text-gray-600 whitespace-pre-line`}>
                {profile.business_address}
              </div>
            ) : (
              <div className={`${isMobilePreview ? 'text-xs' : 'text-sm'} mt-2 text-gray-600`}>
                <div>Your street address</div>
                <div>City, Province Postal code</div>
              </div>
            )}
            {profile?.business_phone && (
              <div className={`${isMobilePreview ? 'text-xs' : 'text-sm'} text-gray-600`}>
                {profile.business_phone}
              </div>
            )}
            {profile?.business_email ? (
              <div className={`${isMobilePreview ? 'text-xs' : 'text-sm'} text-gray-600`}>
                {profile.business_email}
              </div>
            ) : (
              <div className={`${isMobilePreview ? 'text-xs' : 'text-sm'} text-gray-600`}>
                youremail@domain.com
              </div>
            )}
          </div>
        </div>
        
        <div className="text-left sm:text-right">
          <h1 className={`${isMobilePreview ? 'text-3xl' : 'text-5xl'} font-bold text-gray-800`}>
            Invoice
          </h1>
        </div>
      </div>

      {/* Invoice Details and Bill To Section */}
      <div className={isMobilePreview ? 'px-4 py-4' : 'px-8 py-6'}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8 mb-6 sm:mb-8">
          {/* Bill To */}
          <div>
            <div className={`font-bold text-gray-800 mb-2 ${isMobilePreview ? 'text-sm' : ''}`}>
              Invoice to
            </div>
            <div className={`${isMobilePreview ? 'text-xs' : 'text-sm'} text-gray-700`}>
              <div>{invoice.client_name || 'Street address'}</div>
              {invoice.client_address ? (
                <div className="whitespace-pre-line">{invoice.client_address}</div>
              ) : (
                <div>City, Province, Postal code</div>
              )}
            </div>
          </div>
          
          {/* Invoice Details */}
          <div className="text-left sm:text-right">
            <div className={`space-y-2 ${isMobilePreview ? 'text-xs' : 'text-sm'}`}>
              <div className="grid grid-cols-2 gap-2 sm:gap-4">
                <span className="font-semibold text-gray-800">Invoice #</span>
                <span className="text-gray-700 truncate">
                  {invoice.invoice_number || 'Invoice # 00/00/0000'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:gap-4">
                <span className="font-semibold text-gray-800">Date</span>
                <span className="text-gray-700">
                  {formatDate(invoice.issue_date) || '00/00/0000'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:gap-4">
                <span className="font-semibold text-gray-800">Due Date</span>
                <span className="text-gray-700">
                  {formatDate(invoice.due_date) || 'Terms'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className={`mb-6 sm:mb-8 ${isMobilePreview ? 'overflow-x-auto' : ''}`}>
          <table className="w-full min-w-full">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className={`text-left ${isMobilePreview ? 'py-2 text-xs' : 'py-3 text-sm'} font-bold text-gray-800`}>
                  Description
                </th>
                <th className={`text-center ${isMobilePreview ? 'py-2 text-xs w-12' : 'py-3 text-sm w-16'} font-bold text-gray-800`}>
                  Qty
                </th>
                <th className={`text-right ${isMobilePreview ? 'py-2 text-xs w-16' : 'py-3 text-sm w-20'} font-bold text-gray-800`}>
                  Rate
                </th>
                <th className={`text-right ${isMobilePreview ? 'py-2 text-xs w-20' : 'py-3 text-sm w-24'} font-bold text-gray-800`}>
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {items.length > 0 ? items.map((item, index) => (
                <tr key={item.id || index} className="border-b border-gray-200">
                  <td className={`${isMobilePreview ? 'py-2 pr-2' : 'py-4 pr-4'}`}>
                    <div className={`font-semibold text-gray-800 ${isMobilePreview ? 'text-xs' : 'text-sm'}`}>
                      {item.description || 'Item name'}
                    </div>
                    <div className={`text-gray-600 ${isMobilePreview ? 'text-xs' : 'text-sm'}`}>
                      Description of item
                    </div>
                  </td>
                  <td className={`${isMobilePreview ? 'py-2 text-xs' : 'py-4 text-sm'} text-center text-gray-700`}>
                    {item.quantity || 0}
                  </td>
                  <td className={`${isMobilePreview ? 'py-2 text-xs' : 'py-4 text-sm'} text-right text-gray-700`}>
                    {formatCurrency(item.rate)}
                  </td>
                  <td className={`${isMobilePreview ? 'py-2 text-xs' : 'py-4 text-sm'} text-right text-gray-700 font-semibold`}>
                    {formatCurrency(item.amount)}
                  </td>
                </tr>
              )) : (
                // Show placeholder rows when no items
                Array.from({ length: isMobilePreview ? 2 : 4 }, (_, index) => (
                  <tr key={index} className="border-b border-gray-200">
                    <td className={`${isMobilePreview ? 'py-2 pr-2' : 'py-4 pr-4'}`}>
                      <div className={`font-semibold text-gray-400 ${isMobilePreview ? 'text-xs' : 'text-sm'}`}>
                        Item name
                      </div>
                      <div className={`text-gray-400 ${isMobilePreview ? 'text-xs' : 'text-sm'}`}>
                        Description of item
                      </div>
                    </td>
                    <td className={`${isMobilePreview ? 'py-2 text-xs' : 'py-4 text-sm'} text-center text-gray-400`}>
                      0
                    </td>
                    <td className={`${isMobilePreview ? 'py-2 text-xs' : 'py-4 text-sm'} text-right text-gray-400`}>
                      $0.00
                    </td>
                    <td className={`${isMobilePreview ? 'py-2 text-xs' : 'py-4 text-sm'} text-right text-gray-400 font-semibold`}>
                      $0.00
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Message and Totals Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8 mt-6 sm:mt-8">
          {/* Message Section */}
          <div className="order-2 sm:order-1">
            <div className={`font-bold text-gray-800 mb-2 ${isMobilePreview ? 'text-sm' : ''}`}>
              Message
            </div>
            {invoice.notes && (
              <div className={`${isMobilePreview ? 'text-xs' : 'text-sm'} text-gray-700 whitespace-pre-line`}>
                {invoice.notes}
              </div>
            )}
          </div>
          
          {/* Totals Section */}
          <div className="order-1 sm:order-2">
            <div className={`space-y-2 ${isMobilePreview ? 'text-xs' : 'text-sm'}`}>
              <div className="flex justify-between py-1">
                <span className="font-bold text-gray-800">Subtotal</span>
                <span className="text-gray-700 font-semibold">
                  {formatCurrency(invoice.subtotal)}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="font-bold text-gray-800">Discount</span>
                <span className="text-gray-700 font-semibold">$0.00</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="font-bold text-gray-800">Tax</span>
                <span className="text-gray-700 font-semibold">
                  {formatCurrency(invoice.tax_amount)}
                </span>
              </div>
              <div className="flex justify-between py-2 border-t border-gray-300">
                <span className="font-bold text-gray-800">Total</span>
                <span className="text-gray-800 font-bold">
                  {formatCurrency(invoice.total_amount)}
                </span>
              </div>
              <div className={`flex justify-between py-2 mt-4 ${
                isMobilePreview ? 'text-sm' : 'text-lg'
              }`}>
                <span className="font-bold text-gray-800">Balance Due</span>
                <span className="text-gray-800 font-bold">
                  {formatCurrency(invoice.total_amount)}
                </span>
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