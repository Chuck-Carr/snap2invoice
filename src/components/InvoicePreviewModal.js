'use client';

import { useRef, useState } from 'react';
import InvoiceTemplate from './InvoiceTemplate';
import InvoiceTemplatePDF from './InvoiceTemplatePDF';
import { generatePDF } from '../utils/pdfGenerator';

const InvoicePreviewModal = ({ isOpen, onClose, invoice, profile }) => {
  const invoiceRef = useRef();
  const pdfRef = useRef();
  const [isGenerating, setIsGenerating] = useState(false);
  
  console.log('InvoicePreviewModal render:', { isOpen, invoice: !!invoice, profile: !!profile });

  const handleDownloadPDF = async () => {
    setIsGenerating(true);
    try {
      const filename = `invoice-${invoice.invoice_number || 'draft'}.pdf`;
      await generatePDF(pdfRef, filename);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    if (!pdfRef.current) return;
    
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print the invoice.');
      return;
    }
    
    const printContent = pdfRef.current.innerHTML;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice ${invoice.invoice_number || 'Draft'}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
              background: white;
            }
            @media print {
              body { margin: 0; padding: 0; }
            }
          </style>
        </head>
        <body>
          ${printContent}
        </body>
      </html>
    `);
    
    printWindow.document.close();
    
    // Wait for content to load then print
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    };
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex flex-col z-50">
      <div className="bg-white w-full h-full flex flex-col sm:rounded-lg sm:max-w-6xl sm:mx-auto sm:my-4 sm:h-auto sm:max-h-[90vh]">
        {/* Header - Always visible */}
        <div className="flex-shrink-0 bg-white p-3 sm:p-6 border-b border-gray-200 shadow-sm">
          <div className="flex flex-col space-y-3 sm:flex-row sm:justify-between sm:items-center sm:space-y-0">
            <h2 className="text-base sm:text-xl font-semibold text-gray-800 truncate pr-2">
              Invoice Preview - #{invoice.invoice_number}
            </h2>
            
            {/* Action buttons */}
            <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-3">
              <div className="flex space-x-2">
                <button
                  onClick={handlePrint}
                  className="btn-secondary text-sm flex-1 sm:flex-none px-3 py-2"
                  disabled={isGenerating}
                >
                  🖨️ Print
                </button>
                <button
                  onClick={handleDownloadPDF}
                  disabled={isGenerating}
                  className="btn-primary text-sm flex-1 sm:flex-none px-3 py-2"
                >
                  {isGenerating ? 'Generating...' : '📄 PDF'}
                </button>
              </div>
              
              <button
                onClick={onClose}
                className="bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[40px] flex items-center justify-center"
              >
                ✕ Close
              </button>
            </div>
          </div>
        </div>

        {/* Preview Content - Scrollable */}
        <div className="flex-1 overflow-auto bg-gray-100 p-2 sm:p-6">
          <div className="bg-white shadow-lg rounded-lg overflow-hidden max-w-4xl mx-auto">
            <InvoiceTemplate
              ref={invoiceRef}
              invoice={invoice}
              profile={profile}
              isMobilePreview={true}
            />
          </div>
          
          {/* Hidden PDF-optimized version for generation */}
          <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
            <InvoiceTemplatePDF
              ref={pdfRef}
              invoice={invoice}
              profile={profile}
            />
          </div>
        </div>

        {/* Footer - Always visible on desktop, hidden on mobile to save space */}
        <div className="hidden sm:block flex-shrink-0 p-4 sm:p-6 border-t border-gray-200 bg-gray-50 text-center">
          <p className="text-xs sm:text-sm text-gray-600">
            This is a preview of your invoice. Use the buttons above to print or download as PDF.
          </p>
          {profile?.subscription_plan !== 'premium' && (
            <p className="text-xs text-gray-500 mt-2">
              💡 Upgrade to Premium to add your custom logo and remove the &quot;Generated with Snap2Invoice&quot; footer.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default InvoicePreviewModal;