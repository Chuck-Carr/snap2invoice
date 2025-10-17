'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function Navigation() {
  const { user, signOut, loading } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    setIsMobileMenuOpen(false);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center">
            <Link href="/" className="text-xl md:text-2xl font-bold text-blue-600">
              Snap2Invoice
            </Link>
          </div>

          {/* Desktop Navigation */}
          {user && (
            <div className="hidden md:flex space-x-6 ml-8">
              <Link 
                href="/receipts" 
                className="text-gray-600 hover:text-blue-600 transition-colors py-2"
              >
                Receipts
              </Link>
              <Link 
                href="/invoices" 
                className="text-gray-600 hover:text-blue-600 transition-colors py-2"
              >
                Invoices
              </Link>
              <Link 
                href="/account" 
                className="text-gray-600 hover:text-blue-600 transition-colors py-2"
              >
                Account
              </Link>
            </div>
          )}

          <div className="flex items-center space-x-2 md:space-x-4">
            {user ? (
              <>
                {/* Desktop welcome message */}
                <span className="hidden lg:block text-gray-600 text-sm">
                  Welcome, {user.email.split('@')[0]}
                </span>
                <button
                  onClick={handleSignOut}
                  className="btn-secondary text-sm px-3 py-2"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <Link href="/auth" className="btn-primary px-4 py-2">
                Sign In
              </Link>
            )}
            
            {/* Mobile menu button */}
            {user && (
              <button
                className="md:hidden p-2 rounded-md text-gray-600 hover:text-blue-600 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label="Open menu"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {isMobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            )}
          </div>
        </div>
        
        {/* Mobile Navigation Menu */}
        {user && isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 py-4">
            <div className="flex flex-col space-y-3">
              <Link 
                href="/receipts" 
                className="text-gray-600 hover:text-blue-600 transition-colors py-2 px-2 rounded-md hover:bg-gray-50"
                onClick={closeMobileMenu}
              >
                📄 Receipts
              </Link>
              <Link 
                href="/invoices" 
                className="text-gray-600 hover:text-blue-600 transition-colors py-2 px-2 rounded-md hover:bg-gray-50"
                onClick={closeMobileMenu}
              >
                📋 Invoices
              </Link>
              <Link 
                href="/account" 
                className="text-gray-600 hover:text-blue-600 transition-colors py-2 px-2 rounded-md hover:bg-gray-50"
                onClick={closeMobileMenu}
              >
                ⚙️ Account
              </Link>
              <div className="pt-2 border-t border-gray-100">
                <div className="text-sm text-gray-500 px-2 py-1">
                  {user.email}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
