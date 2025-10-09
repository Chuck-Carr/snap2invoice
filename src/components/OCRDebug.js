'use client';

import { useState } from 'react';
import { processReceiptOCR } from '../utils/ocr';

export default function OCRDebug() {
  const [file, setFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const testOCR = async () => {
    if (!file) return;

    setProcessing(true);
    setResult(null);
    setError('');

    try {
      console.log('Testing OCR with file:', file);
      const ocrResult = await processReceiptOCR(file);
      console.log('OCR Result:', ocrResult);
      setResult(ocrResult);
    } catch (err) {
      console.error('OCR Test Error:', err);
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="card max-w-md mx-auto mt-8">
      <h3 className="text-lg font-semibold mb-4">🔍 OCR Debug Tool</h3>
      
      <div className="space-y-4">
        <div>
          <input
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={(e) => setFile(e.target.files[0])}
            className="input-field"
          />
          <p className="text-xs text-gray-500 mt-1">
            Supports: JPG, PNG, WebP (not HEIC)
          </p>
        </div>
        
        <button
          onClick={testOCR}
          disabled={!file || processing}
          className="btn-primary w-full"
        >
          {processing ? 'Testing OCR...' : 'Test OCR'}
        </button>
        
        {error && (
          <div className="bg-red-100 text-red-800 p-3 rounded">
            <strong>Error:</strong> {error}
          </div>
        )}
        
        {result && (
          <div className="bg-gray-100 p-3 rounded">
            <h4 className="font-semibold mb-2">Result:</h4>
            <p><strong>Success:</strong> {result.success ? 'Yes' : 'No'}</p>
            <p><strong>Confidence:</strong> {result.confidence}%</p>
            <p><strong>Text Length:</strong> {result.text?.length || 0} characters</p>
            {result.text && (
              <div className="mt-2">
                <strong>Text Preview:</strong>
                <div className="bg-white p-2 rounded border text-xs mt-1 max-h-32 overflow-y-auto">
                  {result.text.substring(0, 500)}
                  {result.text.length > 500 && '...'}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}