'use client';

import { forwardRef } from 'react';

const InvoiceTemplatePDF = forwardRef(({ invoice, profile }, ref) => {
  const isPremium = profile?.subscription_plan === 'premium';
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
      style={{
        fontFamily: 'Arial, sans-serif',
        backgroundColor: '#ffffff',
        color: '#000000',
        maxWidth: '800px',
        margin: '0 auto',
        padding: '0'
      }}
    >
      {/* Header Section */}
      <div style={{
        padding: '32px',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start'
      }}>
        <div style={{ flex: 1 }}>
          {hasLogo && (
            <img
              src={profile.logo_url}
              alt="Business Logo"
              style={{
                width: '64px',
                height: '64px',
                objectFit: 'contain',
                marginBottom: '16px'
              }}
            />
          )}
          <div>
            <div style={{ 
              fontWeight: '600', 
              fontSize: '20px',
              color: '#2563eb',
              marginBottom: '8px'
            }}>
              {profile?.business_name || 'Your company name'}
            </div>
            {profile?.business_address ? (
              <div style={{ 
                fontSize: '14px', 
                color: '#4b5563',
                whiteSpace: 'pre-line',
                lineHeight: '1.4'
              }}>
                {profile.business_address}
              </div>
            ) : (
              <div style={{ 
                fontSize: '14px', 
                color: '#4b5563',
                lineHeight: '1.4'
              }}>
                <div>Your street address</div>
                <div>City, Province Postal code</div>
              </div>
            )}
            {profile?.business_phone && (
              <div style={{ fontSize: '14px', color: '#4b5563' }}>
                {profile.business_phone}
              </div>
            )}
            {profile?.business_email ? (
              <div style={{ fontSize: '14px', color: '#4b5563' }}>
                {profile.business_email}
              </div>
            ) : (
              <div style={{ fontSize: '14px', color: '#4b5563' }}>
                youremail@domain.com
              </div>
            )}
          </div>
        </div>
        
        <div>
          <h1 style={{
            fontSize: '48px',
            fontWeight: 'bold',
            color: '#1f2937',
            margin: '0'
          }}>
            Invoice
          </h1>
        </div>
      </div>

      {/* Invoice Details and Bill To Section */}
      <div style={{ padding: '32px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '32px',
          marginBottom: '32px'
        }}>
          {/* Bill To */}
          <div>
            <div style={{ 
              fontWeight: 'bold', 
              color: '#1f2937', 
              marginBottom: '8px',
              fontSize: '16px'
            }}>
              Invoice to
            </div>
            <div style={{ fontSize: '14px', color: '#374151' }}>
              <div>{invoice.client_name || 'Street address'}</div>
              {invoice.client_address ? (
                <div style={{ whiteSpace: 'pre-line' }}>{invoice.client_address}</div>
              ) : (
                <div>City, Province, Postal code</div>
              )}
            </div>
          </div>
          
          {/* Invoice Details */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '14px' }}>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '16px',
                marginBottom: '8px'
              }}>
                <span style={{ fontWeight: '600', color: '#1f2937' }}>Invoice #</span>
                <span style={{ color: '#374151' }}>{invoice.invoice_number || 'Invoice # 00/00/0000'}</span>
              </div>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '16px',
                marginBottom: '8px'
              }}>
                <span style={{ fontWeight: '600', color: '#1f2937' }}>Date</span>
                <span style={{ color: '#374151' }}>{formatDate(invoice.issue_date) || '00/00/0000'}</span>
              </div>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '16px',
                marginBottom: '8px'
              }}>
                <span style={{ fontWeight: '600', color: '#1f2937' }}>Due Date</span>
                <span style={{ color: '#374151' }}>{formatDate(invoice.due_date) || 'Terms'}</span>
              </div>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '16px'
              }}>
                <span style={{ fontWeight: '600', color: '#1f2937' }}>Terms</span>
                <span style={{ color: '#374151' }}></span>
              </div>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div style={{ marginBottom: '32px' }}>
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse',
            border: 'none'
          }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #d1d5db' }}>
                <th style={{ 
                  textAlign: 'left', 
                  padding: '12px 0', 
                  fontWeight: 'bold', 
                  color: '#1f2937',
                  width: '50%'
                }}>
                  Description
                </th>
                <th style={{ 
                  textAlign: 'center', 
                  padding: '12px 0', 
                  fontWeight: 'bold', 
                  color: '#1f2937',
                  width: '64px'
                }}>
                  Qty
                </th>
                <th style={{ 
                  textAlign: 'right', 
                  padding: '12px 0', 
                  fontWeight: 'bold', 
                  color: '#1f2937',
                  width: '80px'
                }}>
                  Rate
                </th>
                <th style={{ 
                  textAlign: 'right', 
                  padding: '12px 0', 
                  fontWeight: 'bold', 
                  color: '#1f2937',
                  width: '96px'
                }}>
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {items.length > 0 ? items.map((item, index) => (
                <tr key={item.id || index} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '16px 16px 16px 0' }}>
                    <div style={{ fontWeight: '600', color: '#1f2937' }}>
                      {item.description || 'Item name'}
                    </div>
                    <div style={{ fontSize: '14px', color: '#4b5563' }}>
                      Description of item
                    </div>
                  </td>
                  <td style={{ 
                    padding: '16px 0', 
                    textAlign: 'center', 
                    color: '#374151' 
                  }}>
                    {item.quantity || 0}
                  </td>
                  <td style={{ 
                    padding: '16px 0', 
                    textAlign: 'right', 
                    color: '#374151' 
                  }}>
                    {formatCurrency(item.rate)}
                  </td>
                  <td style={{ 
                    padding: '16px 0', 
                    textAlign: 'right', 
                    color: '#374151', 
                    fontWeight: '600' 
                  }}>
                    {formatCurrency(item.amount)}
                  </td>
                </tr>
              )) : (
                // Show placeholder rows when no items
                Array.from({ length: 4 }, (_, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '16px 16px 16px 0' }}>
                      <div style={{ fontWeight: '600', color: '#9ca3af' }}>Item name</div>
                      <div style={{ fontSize: '14px', color: '#9ca3af' }}>Description of item</div>
                    </td>
                    <td style={{ 
                      padding: '16px 0', 
                      textAlign: 'center', 
                      color: '#9ca3af' 
                    }}>
                      0
                    </td>
                    <td style={{ 
                      padding: '16px 0', 
                      textAlign: 'right', 
                      color: '#9ca3af' 
                    }}>
                      $0.00
                    </td>
                    <td style={{ 
                      padding: '16px 0', 
                      textAlign: 'right', 
                      color: '#9ca3af', 
                      fontWeight: '600' 
                    }}>
                      $0.00
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Message and Totals Section */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '32px',
          marginTop: '32px'
        }}>
          {/* Message Section */}
          <div>
            <div style={{ 
              fontWeight: 'bold', 
              color: '#1f2937', 
              marginBottom: '8px',
              fontSize: '16px'
            }}>
              Message
            </div>
            {invoice.notes && (
              <div style={{ 
                fontSize: '14px', 
                color: '#374151', 
                whiteSpace: 'pre-line' 
              }}>
                {invoice.notes}
              </div>
            )}
          </div>
          
          {/* Totals Section */}
          <div>
            <div style={{ fontSize: '14px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                padding: '4px 0' 
              }}>
                <span style={{ fontWeight: 'bold', color: '#1f2937' }}>Subtotal</span>
                <span style={{ color: '#374151', fontWeight: '600' }}>
                  {formatCurrency(invoice.subtotal)}
                </span>
              </div>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                padding: '4px 0' 
              }}>
                <span style={{ fontWeight: 'bold', color: '#1f2937' }}>Discount</span>
                <span style={{ color: '#374151', fontWeight: '600' }}>$0.00</span>
              </div>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                padding: '4px 0' 
              }}>
                <span style={{ fontWeight: 'bold', color: '#1f2937' }}>Tax</span>
                <span style={{ color: '#374151', fontWeight: '600' }}>
                  {formatCurrency(invoice.tax_amount)}
                </span>
              </div>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                padding: '8px 0', 
                borderTop: '1px solid #d1d5db' 
              }}>
                <span style={{ fontWeight: 'bold', color: '#1f2937' }}>Total</span>
                <span style={{ color: '#1f2937', fontWeight: 'bold' }}>
                  {formatCurrency(invoice.total_amount)}
                </span>
              </div>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                padding: '8px 0', 
                marginTop: '16px' 
              }}>
                <span style={{ 
                  fontWeight: 'bold', 
                  color: '#1f2937', 
                  fontSize: '20px' 
                }}>
                  Balance Due
                </span>
                <span style={{ 
                  color: '#1f2937', 
                  fontWeight: 'bold', 
                  fontSize: '20px' 
                }}>
                  {formatCurrency(invoice.total_amount)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      {!isPremium && (
        <div style={{
          marginTop: '48px',
          paddingTop: '24px',
          borderTop: '1px solid #e5e7eb',
          textAlign: 'center',
          fontSize: '12px',
          color: '#9ca3af'
        }}>
          <p style={{ margin: '0' }}>Generated with Snap2Invoice</p>
        </div>
      )}
    </div>
  );
});

InvoiceTemplatePDF.displayName = 'InvoiceTemplatePDF';

export default InvoiceTemplatePDF;