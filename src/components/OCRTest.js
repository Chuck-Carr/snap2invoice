'use client';

import { useState } from 'react';
import { processReceiptOCR, extractReceiptData, generateInvoiceItems } from '../utils/ocr';

export default function OCRTest() {
  const [file, setFile] = useState(null);
  const [ocrResult, setOcrResult] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [manualText, setManualText] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setOcrResult(null);
      setExtractedData(null);
    }
  };

  const processFile = async () => {
    if (!file) return;

    setProcessing(true);
    console.log('=== Starting OCR Test ===');

    try {
      // Step 1: OCR Processing
      const result = await processReceiptOCR(file);
      setOcrResult(result);
      console.log('OCR Result:', result);

      if (result.success && result.text) {
        // Step 2: Data Extraction
        const extracted = extractReceiptData(result.text);
        const items = generateInvoiceItems(extracted);
        extracted.generatedItems = items;
        
        setExtractedData(extracted);
        console.log('Extracted Data:', extracted);
      }
    } catch (error) {
      console.error('OCR Test Error:', error);
      setOcrResult({ success: false, error: error.message });
    } finally {
      setProcessing(false);
    }
  };

  const processManualText = () => {
    if (!manualText.trim()) return;

    console.log('=== Processing Manual Text ===');
    console.log('Manual text:', manualText);

    // Simulate OCR result
    const mockOcrResult = {
      success: true,
      text: manualText,
      confidence: 100,
      manual: true
    };
    setOcrResult(mockOcrResult);

    // Process the manual text
    const extracted = extractReceiptData(manualText);
    const items = generateInvoiceItems(extracted);
    extracted.generatedItems = items;
    
    setExtractedData(extracted);
    console.log('Extracted Data from manual text:', extracted);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 mt-8">
      <h2 className="text-xl font-semibold mb-4">🧪 OCR Debug Test</h2>
      
      <div className="space-y-4">
        <div>
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          <p className="text-xs text-gray-500 mt-1">
            Supports images (JPG, PNG, WebP) and PDF files
          </p>
        </div>

        {file && (
          <div className="space-y-2">
            <button
              onClick={processFile}
              disabled={processing}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {processing ? 'Processing...' : 'Test OCR'}
            </button>
            
            <button
              onClick={() => setShowManualInput(!showManualInput)}
              className="ml-2 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            >
              {showManualInput ? 'Hide Manual Input' : 'Manual Text Entry'}
            </button>
          </div>
        )}

        {showManualInput && (
          <div className="border rounded p-4 bg-yellow-50">
            <h3 className="font-semibold mb-2">Manual Text Entry</h3>
            <p className="text-sm text-gray-600 mb-2">
              If OCR fails, you can manually type what you see on the receipt:
            </p>
            
            <div className="mb-2">
              <button
                onClick={() => setManualText('SKY line Chili\n10/09/2025 02:36 PM\nDriveThru\nTable 1/1\n#3 Combo $12.50\n-LARGE\nDr. Pepper $12.30\nSubtotal $12.54\nTax $0.24\nTotal $12.54')}
                className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded hover:bg-blue-200"
              >
                Fill Sample Receipt Text
              </button>
            </div>
            
            <textarea
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              className="w-full h-32 p-2 border rounded text-sm"
              placeholder="Type the receipt text here, including prices like $12.50, merchant name, date, etc."
            />
            
            <div className="flex space-x-2 mt-2">
              <button
                onClick={processManualText}
                disabled={!manualText.trim()}
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
              >
                Process Manual Text
              </button>
              
              <button
                onClick={() => setManualText('')}
                className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {ocrResult && (
          <div className="border rounded p-4 bg-gray-50">
            <h3 className="font-semibold mb-2">OCR Result:</h3>
            <p><strong>Success:</strong> {ocrResult.success ? 'Yes' : 'No'}</p>
            <p><strong>Confidence:</strong> {ocrResult.confidence}%</p>
            {ocrResult.error && <p><strong>Error:</strong> {ocrResult.error}</p>}
            
            {ocrResult.text && (
              <div className="mt-4">
                <h4 className="font-medium mb-2">Raw OCR Text:</h4>
                <pre className="text-xs bg-white p-2 rounded border overflow-auto max-h-48">
                  {ocrResult.text}
                </pre>
              </div>
            )}
          </div>
        )}

        {extractedData && (
          <div className="border rounded p-4 bg-green-50">
            <h3 className="font-semibold mb-2">Extracted Data:</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p><strong>Merchant:</strong> {extractedData.merchantName || 'Not found'}</p>
                <p><strong>Date:</strong> {extractedData.date || 'Not found'}</p>
                <p><strong>Total:</strong> ${extractedData.total || '0.00'}</p>
                <p><strong>Tax:</strong> ${extractedData.tax || '0.00'}</p>
              </div>
              <div>
                <p><strong>Items Found:</strong> {extractedData.items.length}</p>
                <p><strong>Generated Items:</strong> {extractedData.generatedItems?.length || 0}</p>
              </div>
            </div>
            
            {extractedData.items && extractedData.items.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium mb-2">Found Items:</h4>
                <div className="space-y-1 text-sm">
                  {extractedData.items.map((item, index) => (
                    <div key={index} className="bg-white p-2 rounded">
                      {item.description} - ${item.amount}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {extractedData.generatedItems && extractedData.generatedItems.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium mb-2">Generated Invoice Items:</h4>
                <div className="space-y-1 text-sm">
                  {extractedData.generatedItems.map((item, index) => (
                    <div key={index} className="bg-white p-2 rounded">
                      {item.description} - Qty: {item.quantity} - Rate: ${item.rate} - Amount: ${item.amount}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}