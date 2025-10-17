'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../contexts/AuthContext';
import Navigation from '../../components/Navigation';
import OCRDebug from '../../components/OCRDebug';
import { processReceiptOCR, extractReceiptData, generateInvoiceItems } from '../../utils/ocr';
import { supabase } from '../supabaseClient';

export default function ReceiptsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [uploadResult, setUploadResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [ocrProgress, setOcrProgress] = useState('');
  const [processingStep, setProcessingStep] = useState('');
  const [receipts, setReceipts] = useState([]);
  const [loadingReceipts, setLoadingReceipts] = useState(true);
  const [selectedReceipts, setSelectedReceipts] = useState([]);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState('');
  const [showAddToInvoiceModal, setShowAddToInvoiceModal] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      fetchReceipts();
      fetchInvoices();
    }
  }, [user]);

  const fetchReceipts = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) return;

      const res = await fetch('/api/receipts', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setReceipts(data.receipts);
      }
    } catch (error) {
      console.error('Error fetching receipts:', error);
    } finally {
      setLoadingReceipts(false);
    }
  };

  const fetchInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, client_name, status')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!error) {
        setInvoices(data);
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (files.length === 0 || !user) return;

    setUploading(true);
    setMessage('');
    setUploadResult(null);
    setOcrProgress('');
    setProcessingStep('Starting upload...');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('Authentication token not found. Please sign in again.');
      }

      const uploadPromises = files.map(async (file, index) => {
        setProcessingStep(`Processing file ${index + 1} of ${files.length}: ${file.name}`);
        
        let ocrText = '';
        let extractedData = null;

        // Step 1: Process OCR if it's an image
        if (file.type.startsWith('image/')) {
          try {
            setOcrProgress('Processing image, this may take a moment...');
            
            const ocrResult = await processReceiptOCR(file);
            
            if (ocrResult.success && ocrResult.text) {
              ocrText = ocrResult.text;
              
              // Extract structured data from OCR text
              extractedData = extractReceiptData(ocrText);
              const invoiceItems = generateInvoiceItems(extractedData);
              extractedData.items = invoiceItems;
              
              if (extractedData.merchantName || extractedData.total > 0 || extractedData.items.length > 0) {
                setOcrProgress(`✅ Processed ${file.name}! Found: ${extractedData.merchantName || 'Receipt'} - $${extractedData.total || '0.00'}`);
              }
            }
          } catch (ocrError) {
            console.error('OCR processing error:', ocrError);
            setOcrProgress(`❌ ${file.name} - Image processing failed`);
          }
        }

        const formData = new FormData();
        formData.append('file', file);
        
        if (ocrText) {
          formData.append('ocrText', ocrText);
        }
        
        if (extractedData) {
          formData.append('ocrData', JSON.stringify(extractedData));
        }
        
        if (selectedInvoice) {
          formData.append('invoiceId', selectedInvoice);
        }

        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        
        return data;
      });

      const results = await Promise.all(uploadPromises);
      
      setMessage(`✅ Successfully uploaded ${results.length} receipt(s)!`);
      setFiles([]);
      setProcessingStep('');
      setShowUploadForm(false);
      
      // Refresh receipts list
      fetchReceipts();
      
      // Redirect to invoice if a new one was created
      const newInvoice = results.find(r => r.invoice);
      if (newInvoice && newInvoice.invoice) {
        setTimeout(() => {
          router.push(`/invoices/${newInvoice.invoice.id}`);
        }, 2000);
      }
      
    } catch (err) {
      setProcessingStep('');
      if (err.message.includes('Monthly limit reached')) {
        setMessage('❌ Monthly limit reached. Please upgrade to premium for unlimited invoices.');
      } else {
        setMessage('❌ ' + err.message);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      file => file.type.startsWith('image/') || file.type === 'application/pdf'
    );
    setFiles(prev => [...prev, ...droppedFiles]);
  };

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files).filter(
      file => file.type.startsWith('image/') || file.type === 'application/pdf'
    );
    setFiles(prev => [...prev, ...selectedFiles]);
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleReceiptSelect = (receiptId) => {
    setSelectedReceipts(prev => 
      prev.includes(receiptId)
        ? prev.filter(id => id !== receiptId)
        : [...prev, receiptId]
    );
  };

  const handleAddToInvoice = async () => {
    if (selectedReceipts.length === 0 || !selectedInvoice) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(`/api/invoices/${selectedInvoice}/add-receipts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ receiptIds: selectedReceipts }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessage(`✅ Successfully linked ${selectedReceipts.length} receipt(s) to invoice!`);
        setSelectedReceipts([]);
        setSelectedInvoice('');
        setShowAddToInvoiceModal(false);
        fetchReceipts(); // Refresh to show updated receipt links
      } else {
        const error = await res.json();
        setMessage(`❌ ${error.error}`);
      }
    } catch (error) {
      console.error('Error linking receipts:', error);
      setMessage('❌ Failed to link receipts to invoice');
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  if (loading || loadingReceipts) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <>
      <Navigation />
      <main className="container mx-auto px-4 py-6 sm:py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 sm:mb-8 space-y-4 sm:space-y-0">
            <h1 className="text-2xl sm:text-3xl font-bold">Your Receipts</h1>
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
              {selectedReceipts.length > 0 && (
                <button
                  onClick={() => setShowAddToInvoiceModal(true)}
                  className="btn-secondary w-full sm:w-auto"
                >
                  Add to Invoice ({selectedReceipts.length})
                </button>
              )}
              <button
                onClick={() => setShowUploadForm(!showUploadForm)}
                className="btn-primary w-full sm:w-auto"
              >
                {showUploadForm ? 'Cancel' : '+ Upload Receipts'}
              </button>
            </div>
          </div>
          
          {showUploadForm && (
            <div className="card mb-6">
              <form onSubmit={handleUpload}>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">
                    Add to existing invoice (optional)
                  </label>
                  <select
                    value={selectedInvoice}
                    onChange={(e) => setSelectedInvoice(e.target.value)}
                    className="w-full p-3 border rounded-lg text-base"
                  >
                    <option value="">Create new invoice</option>
                    {invoices.map(invoice => (
                      <option key={invoice.id} value={invoice.id}>
                        #{invoice.invoice_number} - {invoice.client_name || 'No client name'} ({invoice.status})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    dragOver 
                      ? 'border-blue-500 bg-blue-50' 
                      : files.length > 0 
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-300 hover:border-gray-400'
                  }`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                >
                  <div className="mb-4">
                    <div className="text-4xl mb-2">
                      {files.length > 0 ? '✓' : '📁'}
                    </div>
                    {files.length > 0 ? (
                      <div>
                        <p className="font-medium text-green-700 mb-2">
                          {files.length} file{files.length !== 1 ? 's' : ''} selected
                        </p>
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {files.map((file, index) => (
                            <div key={index} className="flex items-center justify-between bg-white p-2 rounded text-sm">
                              <span>{file.name}</span>
                              <button
                                type="button"
                                onClick={() => removeFile(index)}
                                className="text-red-500 hover:text-red-700"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="mb-2 text-gray-600">
                          Drag and drop your receipts here, or click to browse
                        </p>
                        <p className="text-sm text-gray-500">
                          Supports JPG, PNG, WebP, and PDF files
                        </p>
                        <p className="text-xs text-yellow-600 mt-1">
                          ⚠️ iPhone HEIC files not supported - change camera to &quot;Most Compatible&quot; or convert to JPG
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp,.pdf"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                  />
                  
                  <label htmlFor="file-upload" className="btn-secondary cursor-pointer">
                    Browse Files
                  </label>
                </div>

                <div className="mt-6 flex justify-center">
                  <button
                    type="submit"
                    disabled={files.length === 0 || uploading}
                    className="btn-primary px-8 py-3 text-lg"
                  >
                    {uploading ? (
                      <>
                        <span className="inline-block animate-spin mr-2">⏳</span>
                        {processingStep || 'Processing...'}
                      </>
                    ) : (
                      `Upload & Process ${files.length} Receipt${files.length !== 1 ? 's' : ''}`
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {message && (
            <div className={`p-4 rounded-lg text-center mb-6 ${
              message.includes('✅') 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {message}
            </div>
          )}

          {ocrProgress && (
            <div className="card bg-green-50 border-green-200 mb-6">
              <h3 className="font-semibold text-green-800 mb-2">
                🔍 OCR Processing Result
              </h3>
              <p className="text-green-700">
                {ocrProgress}
              </p>
            </div>
          )}

          {/* Receipts Grid */}
          {receipts.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🧾</div>
              <h2 className="text-2xl font-semibold mb-2">No receipts yet</h2>
              <p className="text-gray-600 mb-6">
                Upload your first receipt to get started
              </p>
              <button
                onClick={() => setShowUploadForm(true)}
                className="btn-primary"
              >
                Upload Receipt
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {receipts.map((receipt) => (
                <div key={receipt.id} className={`card cursor-pointer transition-colors ${
                  selectedReceipts.includes(receipt.id) ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                }`}>
                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      checked={selectedReceipts.includes(receipt.id)}
                      onChange={() => handleReceiptSelect(receipt.id)}
                      className="mt-1 h-4 w-4 touch-target"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-sm truncate pr-2">
                          {receipt.file_name}
                        </h3>
                        {receipt.ocr_processed && (
                          <span className="text-green-600 text-xs whitespace-nowrap">✓ OCR</span>
                        )}
                      </div>
                      
                      {receipt.invoices && receipt.invoices.length > 0 ? (
                        <div className="text-sm text-blue-600 mb-2">
                          📄 Linked to: #{receipt.invoices[0].invoice_number}
                          <br />
                          <span className="text-gray-600">
                            {receipt.invoices[0].client_name || 'No client name'}
                          </span>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500 mb-2">
                          📎 Not linked to any invoice
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          {new Date(receipt.created_at).toLocaleDateString()}
                        </span>
                        <a
                          href={receipt.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          View ↗️
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          
          {/* Add to Invoice Modal */}
          {showAddToInvoiceModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <h3 className="text-lg font-semibold mb-4">Add Receipts to Invoice</h3>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">
                    Select Invoice
                  </label>
                  <select
                    value={selectedInvoice}
                    onChange={(e) => setSelectedInvoice(e.target.value)}
                    className="w-full p-2 border rounded-lg"
                  >
                    <option value="">Choose an invoice...</option>
                    {invoices.map(invoice => (
                      <option key={invoice.id} value={invoice.id}>
                        #{invoice.invoice_number} - {invoice.client_name || 'No client name'} ({invoice.status})
                      </option>
                    ))}
                  </select>
                </div>
                
                <p className="text-sm text-gray-600 mb-4">
                  Adding {selectedReceipts.length} receipt{selectedReceipts.length !== 1 ? 's' : ''} to the selected invoice.
                </p>
                
                <div className="flex justify-end space-x-4">
                  <button
                    onClick={() => {
                      setShowAddToInvoiceModal(false);
                      setSelectedInvoice('');
                    }}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddToInvoice}
                    disabled={!selectedInvoice}
                    className="btn-primary"
                  >
                    Add to Invoice
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* How it works info */}
          <div className="mt-8 sm:mt-12 text-center text-gray-500">
            <h3 className="font-semibold mb-4 sm:mb-2">How it works:</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-3xl sm:text-2xl mb-2 sm:mb-1">📤</div>
                <p>Upload receipts</p>
              </div>
              <div>
                <div className="text-3xl sm:text-2xl mb-2 sm:mb-1">🔍</div>
                <p>AI extracts data</p>
              </div>
              <div>
                <div className="text-3xl sm:text-2xl mb-2 sm:mb-1">📋</div>
                <p>Create/edit invoices</p>
              </div>
              <div>
                <div className="text-3xl sm:text-2xl mb-2 sm:mb-1">🔗</div>
                <p>Link multiple receipts</p>
              </div>
            </div>
          </div>
          
          {/* Debug tool - remove in production */}
          <OCRDebug />
        </div>
      </main>
    </>
  );
}
