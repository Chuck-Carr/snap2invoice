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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">
            Invoice Preview - #{invoice.invoice_number}
          </h2>
          <div className="flex space-x-3">
            <button
              onClick={handlePrint}
              className="btn-secondary text-sm"
              disabled={isGenerating}
            >
              🖨️ Print
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={isGenerating}
              className="btn-primary text-sm"
            >
              {isGenerating ? 'Generating...' : '📄 Download PDF'}
            </button>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-xl font-bold px-2"
            >
              ×
            </button>
          </div>
        </div>

        {/* Preview Content */}
        <div className="flex-1 overflow-auto p-6 bg-gray-100">
          <div className="max-w-4xl mx-auto bg-white shadow-lg">
            <InvoiceTemplate
              ref={invoiceRef}
              invoice={invoice}
              profile={profile}
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

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 text-center">
          <p className="text-sm text-gray-600">
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