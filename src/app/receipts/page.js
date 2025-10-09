'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../contexts/AuthContext';
import Navigation from '../../components/Navigation';
import OCRDebug from '../../components/OCRDebug';
import OCRTest from '../../components/OCRTest';
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
  const [skipOCR, setSkipOCR] = useState(false);

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

        // Step 1: Process OCR if it's an image or PDF and OCR is not skipped
        if ((file.type.startsWith('image/') || file.type === 'application/pdf') && !skipOCR) {
          try {
            const fileType = file.type === 'application/pdf' ? 'PDF' : 'image';
            setOcrProgress(`Processing ${fileType}, this may take a moment...`);
            
            const ocrResult = await processReceiptOCR(file);
            
            if (ocrResult.success && ocrResult.text) {
              ocrText = ocrResult.text;
              
              // Extract structured data from OCR text
              extractedData = extractReceiptData(ocrText);
              const invoiceItems = generateInvoiceItems(extractedData);
              extractedData.items = invoiceItems;
              
              const confidence = ocrResult.confidence || 0;
              const lowConfidence = ocrResult.lowConfidence || confidence < 50;
              
              if (extractedData.merchantName || extractedData.total > 0 || extractedData.items.length > 0) {
                const confidenceText = lowConfidence ? ` (${Math.round(confidence)}% confidence - may need review)` : '';
                setOcrProgress(`✅ Processed ${file.name}! Found: ${extractedData.merchantName || 'Receipt'} - $${extractedData.total || '0.00'}${confidenceText}`);
              } else {
                const confidenceText = lowConfidence ? ` (${Math.round(confidence)}% confidence)` : '';
                setOcrProgress(`⚠️ ${file.name} - Some text found but no receipt data detected${confidenceText} - you can add items manually`);
              }
            } else {
              setOcrProgress(`❌ ${file.name} - OCR failed: ${ocrResult.error || `Could not read text from ${fileType}`} - you can add items manually`);
            }
          } catch (ocrError) {
            console.error('OCR processing error:', ocrError);
            const fileType = file.type === 'application/pdf' ? 'PDF' : 'image';
            setOcrProgress(`❌ ${file.name} - ${fileType} processing failed`);
          }
        } else if ((file.type.startsWith('image/') || file.type === 'application/pdf') && skipOCR) {
          const fileType = file.type === 'application/pdf' ? 'PDF' : 'image';
          setOcrProgress(`⏭️ ${file.name} - OCR skipped for ${fileType}, upload only`);
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
    // Find the receipt to check if it's already linked
    const receipt = receipts.find(r => r.id === receiptId);
    const isLinked = receipt && receipt.invoices && receipt.invoices.length > 0;
    
    // Don't allow selecting already linked receipts for new invoice creation
    if (isLinked) {
      setMessage('⚠️ This receipt is already linked to an invoice. You can only select unlinked receipts for creating new invoices.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    
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

  const handleDeleteReceipts = async () => {
    if (selectedReceipts.length === 0) return;

    const confirmMessage = `Are you sure you want to delete ${selectedReceipts.length} receipt(s)? This action cannot be undone.`;
    if (!confirm(confirmMessage)) return;

    await deleteReceipts(selectedReceipts);
  };

  const handleDeleteSingleReceipt = async (receiptId) => {
    const confirmMessage = 'Are you sure you want to delete this receipt? This action cannot be undone.';
    if (!confirm(confirmMessage)) return;

    await deleteReceipts([receiptId]);
  };

  const deleteReceipts = async (receiptIds) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        setMessage('❌ Authentication error. Please refresh and try again.');
        return;
      }

      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      // Delete each receipt individually
      for (const receiptId of receiptIds) {
        try {
          const res = await fetch(`/api/receipts/${receiptId}/delete`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (res.ok) {
            successCount++;
          } else {
            errorCount++;
            const error = await res.json();
            errors.push(error.error || 'Unknown error');
          }
        } catch (error) {
          errorCount++;
          errors.push(error.message || 'Network error');
        }
      }

      // Show results
      if (successCount > 0 && errorCount === 0) {
        setMessage(`✅ Successfully deleted ${successCount} receipt(s)!`);
      } else if (successCount > 0 && errorCount > 0) {
        setMessage(`⚠️ Deleted ${successCount} receipt(s), but ${errorCount} failed. Errors: ${errors.join(', ')}`);
      } else {
        setMessage(`❌ Failed to delete receipts. Errors: ${errors.join(', ')}`);
      }

      setSelectedReceipts(prev => prev.filter(id => !receiptIds.includes(id)));
      fetchReceipts(); // Refresh the list
    } catch (error) {
      console.error('Error deleting receipts:', error);
      setMessage('❌ Failed to delete receipts');
    }
  };

  const handleCreateNewInvoice = async () => {
    if (selectedReceipts.length === 0) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        setMessage('❌ Authentication error. Please refresh and try again.');
        return;
      }

      setMessage('🔄 Creating new invoice...');

      const res = await fetch('/api/invoices/create-from-receipts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ receiptIds: selectedReceipts }),
      });

      if (res.ok) {
        const data = await res.json();
        const invoice = data.invoice;
        const itemsInfo = invoice.itemCount > 0 
          ? ` Extracted ${invoice.itemCount} items, total: $${invoice.totalAmount}` 
          : ` No items extracted - please add manually`;
        const ocrInfo = invoice.ocrProcessedCount > 0 
          ? ` (${invoice.ocrProcessedCount} receipts processed with OCR)` 
          : ` (no OCR data available)`;
        
        setMessage(`✅ Created invoice #${invoice.invoiceNumber}!${itemsInfo}${ocrInfo}`);
        setSelectedReceipts([]);
        fetchReceipts(); // Refresh to show updated receipt links
        
        // Redirect to the new invoice
        setTimeout(() => {
          router.push(`/invoices/${data.invoice.id}`);
        }, 2000);
      } else {
        const error = await res.json();
        setMessage(`❌ ${error.error}`);
      }
    } catch (error) {
      console.error('Error creating invoice:', error);
      setMessage('❌ Failed to create invoice from receipts');
    }
  };

  const handleSelectAllUnlinked = () => {
    const unlinkedReceipts = receipts.filter(receipt => 
      !receipt.invoices || receipt.invoices.length === 0
    );
    const unlinkedIds = unlinkedReceipts.map(receipt => receipt.id);
    setSelectedReceipts(unlinkedIds);
  };

  const handleDeselectAll = () => {
    setSelectedReceipts([]);
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
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2">Your Receipts</h1>
              {receipts.length > 0 && (
                <>
                  <div className="text-sm text-gray-600 mb-2">
                    {(() => {
                      const unlinkedCount = receipts.filter(r => !r.invoices || r.invoices.length === 0).length;
                      const linkedCount = receipts.length - unlinkedCount;
                      return `${receipts.length} total • ${unlinkedCount} unlinked • ${linkedCount} linked`;
                    })()} 
                    {selectedReceipts.length > 0 && ` • ${selectedReceipts.length} selected`}
                  </div>
                  <div className="flex space-x-4 text-sm">
                    <button
                      onClick={handleSelectAllUnlinked}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      Select All Unlinked
                    </button>
                    {selectedReceipts.length > 0 && (
                      <button
                        onClick={handleDeselectAll}
                        className="text-gray-600 hover:text-gray-800"
                      >
                        Deselect All
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="flex space-x-4">
              {selectedReceipts.length > 0 && (
                <>
                  <button
                    onClick={() => setShowAddToInvoiceModal(true)}
                    className="btn-secondary"
                  >
                    Add to Invoice ({selectedReceipts.length})
                  </button>
                  <button
                    onClick={() => handleCreateNewInvoice()}
                    className="btn-primary"
                  >
                    Create New Invoice ({selectedReceipts.length})
                  </button>
                  <button
                    onClick={handleDeleteReceipts}
                    className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                  >
                    Delete ({selectedReceipts.length})
                  </button>
                </>
              )}
              <button
                onClick={() => setShowUploadForm(!showUploadForm)}
                className={selectedReceipts.length > 0 ? "btn-secondary" : "btn-primary"}
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
                    className="w-full p-2 border rounded-lg"
                  >
                    <option value="">Create new invoice</option>
                    {invoices.map(invoice => (
                      <option key={invoice.id} value={invoice.id}>
                        #{invoice.invoice_number} - {invoice.client_name || 'No client name'} ({invoice.status})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="mb-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={skipOCR}
                      onChange={(e) => setSkipOCR(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">
                      Skip OCR processing (upload receipts without text extraction)
                    </span>
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    Use this if OCR is giving poor results - you can add invoice items manually later
                  </p>
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
                        <p className="text-xs text-green-600">
                          📄 PDF files: Text will be extracted directly when possible, OCR for scanned PDFs
                        </p>
                        <div className="text-xs text-gray-500 mt-2 space-y-1">
                          <p className="text-yellow-600">
                            ⚠️ iPhone HEIC files not supported - change camera to "Most Compatible" or convert to JPG
                          </p>
                          <p>
                            📷 <strong>For better OCR results:</strong> Ensure good lighting, keep receipt flat, avoid shadows, and capture the entire receipt
                          </p>
                          <p>
                            🔄 If OCR fails, you can still upload the receipt and add invoice items manually
                          </p>
                        </div>
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

          {/* Helper text for receipt selection */}
          {receipts.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h3 className="font-medium text-gray-900 mb-2">Receipt Management Guide:</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-gray-300 rounded"></div>
                  <span className="text-gray-600">Unlinked receipts - can be selected for new invoices</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-green-300 bg-green-50 rounded opacity-75"></div>
                  <span className="text-gray-600">Linked receipts - already associated with invoices</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-blue-500 bg-blue-50 rounded"></div>
                  <span className="text-gray-600">Selected receipts - ready for action</span>
                </div>
              </div>
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
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {receipts.map((receipt) => {
                const isLinked = receipt.invoices && receipt.invoices.length > 0;
                const isSelected = selectedReceipts.includes(receipt.id);
                
                return (
                  <div key={receipt.id} className={`card transition-colors ${
                    isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                  } ${
                    isLinked ? 'opacity-75 border-green-200' : 'cursor-pointer'
                  }`}>
                    <div className="flex items-start space-x-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleReceiptSelect(receipt.id)}
                        disabled={isLinked}
                        className={`mt-1 ${isLinked ? 'opacity-50 cursor-not-allowed' : ''}`}
                      />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-sm truncate">
                          {receipt.file_name}
                        </h3>
                        {receipt.ocr_processed && (
                          <span className="text-green-600 text-xs">✓ OCR</span>
                        )}
                      </div>
                      
                      {receipt.invoices && receipt.invoices.length > 0 ? (
                        <div className="text-sm mb-2">
                          <div className="text-blue-600">
                            📄 Linked to: #{receipt.invoices[0].invoice_number}
                          </div>
                          <div className="text-gray-600">
                            {receipt.invoices[0].client_name || 'No client name'}
                          </div>
                          <Link 
                            href={`/invoices/${receipt.invoices[0].id}`}
                            className="text-xs text-blue-500 hover:text-blue-700"
                          >
                            Edit Invoice →
                          </Link>
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
                        <div className="flex space-x-2">
                          <a
                            href={receipt.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-sm"
                            onClick={(e) => e.stopPropagation()}
                          >
                            View ↗️
                          </a>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSingleReceipt(receipt.id);
                            }}
                            className="text-red-600 hover:text-red-800 text-sm px-1"
                            title="Delete receipt"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                );
              })}
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
          <div className="mt-12 text-center text-gray-500">
            <h3 className="font-semibold mb-2">How it works:</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-2xl mb-1">📤</div>
                <p>Upload receipts</p>
              </div>
              <div>
                <div className="text-2xl mb-1">🔍</div>
                <p>AI extracts data</p>
              </div>
              <div>
                <div className="text-2xl mb-1">📋</div>
                <p>Create/edit invoices</p>
              </div>
              <div>
                <div className="text-2xl mb-1">🔗</div>
                <p>Link multiple receipts</p>
              </div>
            </div>
          </div>
          
          {/* Debug tools - remove in production */}
          <OCRTest />
          <OCRDebug />
        </div>
      </main>
    </>
  );
}
