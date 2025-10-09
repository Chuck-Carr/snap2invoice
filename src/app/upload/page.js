'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import Navigation from '../../components/Navigation';
import OCRDebug from '../../components/OCRDebug';
import { processReceiptOCR, extractReceiptData, generateInvoiceItems } from '../../utils/ocr';

export default function UploadPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [uploadResult, setUploadResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [ocrProgress, setOcrProgress] = useState('');
  const [processingStep, setProcessingStep] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth');
    }
  }, [user, loading, router]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file || !user) return;

    setUploading(true);
    setMessage('');
    setUploadResult(null);
    setOcrProgress('');
    setProcessingStep('Starting upload...');

    let ocrText = '';
    let extractedData = null;

    try {
      // Step 1: Process OCR if it's an image
      if (file.type.startsWith('image/')) {
        try {
          setProcessingStep('Reading receipt text...');
          setOcrProgress('Processing image, this may take a moment...');
          
          console.log('Starting OCR for file:', file.name, file.type, 'Size:', file.size);
          
          const ocrResult = await processReceiptOCR(file);
          
          if (ocrResult.success && ocrResult.text) {
            ocrText = ocrResult.text;
            setProcessingStep('Extracting invoice data...');
            
            console.log('OCR Text extracted:', ocrText.substring(0, 100) + '...');
            
            // Extract structured data from OCR text
            extractedData = extractReceiptData(ocrText);
            const invoiceItems = generateInvoiceItems(extractedData);
            extractedData.items = invoiceItems;
            
            console.log('Extracted data:', extractedData);
            
            if (extractedData.merchantName || extractedData.total > 0 || extractedData.items.length > 0) {
              setOcrProgress(`✅ Processed! Found: ${extractedData.merchantName || 'Receipt'} - $${extractedData.total || '0.00'}`);
            } else {
              setOcrProgress('⚠️ Text found but no receipt data detected - you can add items manually');
            }
          } else {
            console.log('OCR failed:', ocrResult.error);
            setOcrProgress(`❌ OCR failed: ${ocrResult.error || 'Could not read text from image'} - you can add items manually`);
          }
        } catch (ocrError) {
          console.error('OCR processing error:', ocrError);
          setOcrProgress('❌ Image processing failed - you can add items manually');
        }
      } else {
        setOcrProgress('📄 PDF uploaded - OCR skipped, manual entry available');
      }

      // Step 2: Upload file and create records
      setProcessingStep('Uploading file...');
      
      // Get user's access token from Supabase
      const { supabase } = await import('../../app/supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('Authentication token not found. Please sign in again.');
      }

      const formData = new FormData();
      formData.append('file', file);
      
      if (ocrText) {
        formData.append('ocrText', ocrText);
      }
      
      if (extractedData) {
        formData.append('ocrData', JSON.stringify(extractedData));
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

      setUploadResult(data);
      setMessage('✅ Upload and processing successful!');
      setFile(null);
      setProcessingStep('');
      
      // Redirect to invoices if an invoice was created
      if (data.invoice) {
        setTimeout(() => {
          router.push(`/invoices/${data.invoice.id}`);
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
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.type.startsWith('image/') || droppedFile.type === 'application/pdf')) {
      setFile(droppedFile);
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

  if (loading) {
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
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-6 text-center">Upload Receipt</h1>
          
          <div className="card mb-6">
            <form onSubmit={handleUpload}>
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragOver 
                    ? 'border-blue-500 bg-blue-50' 
                    : file 
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-300 hover:border-gray-400'
                }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <div className="mb-4">
                  <div className="text-4xl mb-2">
                    {file ? '✓' : '📁'}
                  </div>
                  {file ? (
                    <div>
                      <p className="font-medium text-green-700">{file.name}</p>
                      <p className="text-sm text-gray-500">
                        Size: {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="mb-2 text-gray-600">
                        Drag and drop your receipt here, or click to browse
                      </p>
                      <p className="text-sm text-gray-500">
                        Supports JPG, PNG, WebP, and PDF files
                      </p>
                      <p className="text-xs text-yellow-600 mt-1">
                        ⚠️ iPhone HEIC files not supported - change camera to "Most Compatible" or convert to JPG
                      </p>
                    </div>
                  )}
                </div>
                
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,.pdf"
                  onChange={(e) => setFile(e.target.files[0])}
                  className="hidden"
                  id="file-upload"
                />
                
                <label htmlFor="file-upload" className="btn-secondary cursor-pointer">
                  {file ? 'Choose Different File' : 'Browse Files'}
                </label>
              </div>

              <div className="mt-6 flex justify-center">
                <button
                  type="submit"
                  disabled={!file || uploading}
                  className="btn-primary px-8 py-3 text-lg"
                >
                  {uploading ? (
                    <>
                      <span className="inline-block animate-spin mr-2">⏳</span>
                      {processingStep || 'Processing...'}
                    </>
                  ) : (
                    'Upload & Process Receipt'
                  )}
                </button>
              </div>
            </form>
          </div>

          {message && (
            <div className={`p-4 rounded-lg text-center mb-4 ${
              message.includes('✅') 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {message}
            </div>
          )}

          {ocrProgress && (
            <div className="card bg-green-50 border-green-200">
              <h3 className="font-semibold text-green-800 mb-2">
                🔍 OCR Processing Result
              </h3>
              <p className="text-green-700">
                {ocrProgress}
              </p>
            </div>
          )}

          {uploadResult && uploadResult.invoice && (
            <div className="card bg-blue-50 border-blue-200">
              <h3 className="font-semibold text-blue-800 mb-2">
                🎉 Invoice Created Successfully!
              </h3>
              <p className="text-blue-700 mb-4">
                Invoice #{uploadResult.invoice.invoiceNumber} has been created from your receipt.
              </p>
              <p className="text-sm text-blue-600">
                Redirecting to invoice editor...
              </p>
            </div>
          )}

          <div className="mt-8 text-center text-gray-500">
            <h3 className="font-semibold mb-2">How it works:</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-2xl mb-1">📤</div>
                <p>Upload your receipt</p>
              </div>
              <div>
                <div className="text-2xl mb-1">🔍</div>
                <p>AI extracts the data</p>
              </div>
              <div>
                <div className="text-2xl mb-1">📋</div>
                <p>Edit & finalize invoice</p>
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
