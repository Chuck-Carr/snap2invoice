'use client';

import Navigation from '../components/Navigation';
import { useAuth } from '../contexts/AuthContext';
import Link from 'next/link';

export default function Home() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  return (
    <>
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Snap2Invoice
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Snap a receipt, get a professional invoice. Simple, fast, and automated.
          </p>
        </div>

        {user ? (
          <div className="max-w-2xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="card text-center">
                <h3 className="text-xl font-semibold mb-4">Upload Receipt</h3>
                <p className="text-gray-600 mb-4">
                  Take a photo or upload an image of your receipt to get started.
                </p>
                <Link href="/upload" className="btn-primary inline-block">
                  Upload Now
                </Link>
              </div>
              
              <div className="card text-center">
                <h3 className="text-xl font-semibold mb-4">View Invoices</h3>
                <p className="text-gray-600 mb-4">
                  Access and manage all your generated invoices.
                </p>
                <Link href="/invoices" className="btn-primary inline-block">
                  View Invoices
                </Link>
              </div>
            </div>
            
            <div className="mt-8 text-center">
              <p className="text-sm text-gray-500">
                Free users get 3 invoices per month. Upgrade for unlimited invoices and custom branding!
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="max-w-md mx-auto card">
              <h2 className="text-2xl font-semibold mb-4">Get Started Today</h2>
              <p className="text-gray-600 mb-6">
                Sign up for free and create up to 3 professional invoices per month.
              </p>
              <Link href="/auth" className="btn-primary inline-block">
                Sign Up Free
              </Link>
            </div>
            
            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="text-3xl mb-4">📸</div>
                <h3 className="text-lg font-semibold mb-2">Snap</h3>
                <p className="text-gray-600">Take a photo of your receipt</p>
              </div>
              
              <div className="text-center">
                <div className="text-3xl mb-4">🔍</div>
                <h3 className="text-lg font-semibold mb-2">Process</h3>
                <p className="text-gray-600">AI reads and extracts the data</p>
              </div>
              
              <div className="text-center">
                <div className="text-3xl mb-4">📄</div>
                <h3 className="text-lg font-semibold mb-2">Invoice</h3>
                <p className="text-gray-600">Get a professional invoice</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
