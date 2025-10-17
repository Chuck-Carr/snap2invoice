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
      <main className="container mx-auto px-4 py-6 sm:py-8">
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Snap2Invoice
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 mb-6 sm:mb-8 px-2">
            Snap a receipt, get a professional invoice. Simple, fast, and automated.
          </p>
        </div>

        {user ? (
          <div className="max-w-2xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="card text-center">
                <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Upload Receipt</h3>
                <p className="text-gray-600 mb-4 text-sm sm:text-base">
                  Take a photo or upload an image of your receipt to get started.
                </p>
                <Link href="/upload" className="btn-primary w-full sm:w-auto">
                  Upload Now
                </Link>
              </div>
              
              <div className="card text-center">
                <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">View Invoices</h3>
                <p className="text-gray-600 mb-4 text-sm sm:text-base">
                  Access and manage all your generated invoices.
                </p>
                <Link href="/invoices" className="btn-primary w-full sm:w-auto">
                  View Invoices
                </Link>
              </div>
            </div>
            
            <div className="mt-6 sm:mt-8 text-center">
              <p className="text-sm text-gray-500 px-4">
                Free users get 3 invoices per month. Upgrade for unlimited invoices and custom branding!
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="max-w-md mx-auto card">
              <h2 className="text-xl sm:text-2xl font-semibold mb-4">Get Started Today</h2>
              <p className="text-gray-600 mb-6 text-sm sm:text-base">
                Sign up for free and create up to 3 professional invoices per month.
              </p>
              <Link href="/auth" className="btn-primary w-full sm:w-auto">
                Sign Up Free
              </Link>
            </div>
            
            <div className="mt-8 sm:mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
              <div className="text-center">
                <div className="text-4xl sm:text-3xl mb-3 sm:mb-4">📸</div>
                <h3 className="text-lg font-semibold mb-2">Snap</h3>
                <p className="text-gray-600 text-sm sm:text-base">Take a photo of your receipt</p>
              </div>
              
              <div className="text-center">
                <div className="text-4xl sm:text-3xl mb-3 sm:mb-4">🔍</div>
                <h3 className="text-lg font-semibold mb-2">Process</h3>
                <p className="text-gray-600 text-sm sm:text-base">AI reads and extracts the data</p>
              </div>
              
              <div className="text-center">
                <div className="text-4xl sm:text-3xl mb-3 sm:mb-4">📄</div>
                <h3 className="text-lg font-semibold mb-2">Invoice</h3>
                <p className="text-gray-600 text-sm sm:text-base">Get a professional invoice</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
