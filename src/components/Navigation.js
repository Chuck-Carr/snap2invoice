'use client';

import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';

export default function Navigation() {
  const { user, signOut, loading } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center space-x-4">
            <Link href="/" className="text-2xl font-bold text-blue-600">
              Snap2Invoice
            </Link>
            
            {user && (
              <div className="flex space-x-4 ml-8">
                <Link 
                  href="/upload" 
                  className="text-gray-600 hover:text-blue-600 transition-colors"
                >
                  Upload Receipt
                </Link>
                <Link 
                  href="/invoices" 
                  className="text-gray-600 hover:text-blue-600 transition-colors"
                >
                  Invoices
                </Link>
                <Link 
                  href="/account" 
                  className="text-gray-600 hover:text-blue-600 transition-colors"
                >
                  Account
                </Link>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <span className="text-gray-600">
                  Welcome, {user.email}
                </span>
                <button
                  onClick={handleSignOut}
                  className="btn-secondary text-sm"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <Link href="/auth" className="btn-primary">
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}