'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../app/supabaseClient';

export default function Auth() {
  const { signIn, signUp } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState(null);
  const [isLocked, setIsLocked] = useState(false);

  // Check lockout status on component mount and when email changes
  useEffect(() => {
    const checkLockout = () => {
      const lockoutKey = `lockout_${email}`;
      const attemptsKey = `attempts_${email}`;
      const lockoutData = localStorage.getItem(lockoutKey);
      const attempts = parseInt(localStorage.getItem(attemptsKey) || '0');
      
      if (lockoutData) {
        const lockoutTime = new Date(lockoutData);
        if (new Date() < lockoutTime) {
          setIsLocked(true);
          setLockoutUntil(lockoutTime);
          setFailedAttempts(attempts);
        } else {
          // Lockout expired, clear it
          localStorage.removeItem(lockoutKey);
          localStorage.removeItem(attemptsKey);
          setIsLocked(false);
          setLockoutUntil(null);
          setFailedAttempts(0);
        }
      } else {
        setFailedAttempts(attempts);
      }
    };

    if (email) {
      checkLockout();
    }
  }, [email]);

  const handleFailedAttempt = () => {
    const attemptsKey = `attempts_${email}`;
    const lockoutKey = `lockout_${email}`;
    const newAttempts = failedAttempts + 1;
    
    setFailedAttempts(newAttempts);
    localStorage.setItem(attemptsKey, newAttempts.toString());
    
    if (newAttempts >= 5) {
      // Lock account for 15 minutes
      const lockoutTime = new Date(Date.now() + 15 * 60 * 1000);
      localStorage.setItem(lockoutKey, lockoutTime.toISOString());
      setLockoutUntil(lockoutTime);
      setIsLocked(true);
      setMessage('Account locked due to too many failed attempts. Please try again in 15 minutes or reset your password.');
    } else {
      setMessage(`Invalid credentials. ${5 - newAttempts} attempts remaining before account lockout.`);
    }
  };

  const clearFailedAttempts = () => {
    const attemptsKey = `attempts_${email}`;
    localStorage.removeItem(attemptsKey);
    setFailedAttempts(0);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!email) {
      setMessage('Please enter your email address');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) {
        setMessage(error.message);
      } else {
        setMessage('✅ Password reset email sent! Check your inbox.');
        // Clear any lockout for this email since they're resetting password
        localStorage.removeItem(`lockout_${email}`);
        localStorage.removeItem(`attempts_${email}`);
        setIsLocked(false);
        setFailedAttempts(0);
      }
    } catch (err) {
      setMessage('Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (isLocked) {
      setMessage('Account is locked. Please wait or reset your password.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const { error } = isSignUp 
        ? await signUp(email, password)
        : await signIn(email, password);

      if (error) {
        if (!isSignUp && error.message.includes('Invalid login credentials')) {
          handleFailedAttempt();
        } else {
          setMessage(error.message);
        }
      } else {
        // Success - clear any failed attempts
        clearFailedAttempts();
        if (isSignUp) {
          setMessage('✅ Check your email to confirm your account!');
        }
      }
    } catch (err) {
      setMessage('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatTimeRemaining = (lockoutTime) => {
    const remaining = Math.max(0, lockoutTime - new Date());
    const minutes = Math.floor(remaining / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {isForgotPassword 
              ? 'Reset your password' 
              : isSignUp 
                ? 'Create your account' 
                : 'Sign in to your account'
            }
          </h2>
        </div>
        
        {/* Lockout Warning */}
        {isLocked && lockoutUntil && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <div className="text-red-400 text-xl mr-3">⚠️</div>
              <div>
                <h3 className="text-sm font-medium text-red-800">Account Locked</h3>
                <p className="text-sm text-red-700 mt-1">
                  Too many failed login attempts. Time remaining: {formatTimeRemaining(lockoutUntil)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Failed Attempts Warning */}
        {!isLocked && failedAttempts > 0 && failedAttempts < 5 && !isSignUp && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800">
              ⚠️ {failedAttempts}/5 failed attempts. Account will be locked after 5 attempts.
            </p>
          </div>
        )}
        
        <form className="mt-8 space-y-6" onSubmit={isForgotPassword ? handleForgotPassword : handleSubmit}>
          <div>
            <label htmlFor="email" className="sr-only">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="input-field"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          
          {!isForgotPassword && (
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="input-field"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading || isLocked}
              className="btn-primary w-full"
            >
              {loading 
                ? 'Loading...' 
                : isForgotPassword 
                  ? 'Send Reset Email'
                  : isSignUp 
                    ? 'Sign Up' 
                    : 'Sign In'
              }
            </button>
          </div>

          <div className="text-center space-y-2">
            {!isForgotPassword && !isSignUp && (
              <div>
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(true)}
                  className="text-blue-600 hover:text-blue-500 text-sm"
                >
                  Forgot your password?
                </button>
              </div>
            )}
            
            {!isForgotPassword && (
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-blue-600 hover:text-blue-500"
              >
                {isSignUp 
                  ? 'Already have an account? Sign in' 
                  : "Don't have an account? Sign up"}
              </button>
            )}
            
            {isForgotPassword && (
              <button
                type="button"
                onClick={() => {
                  setIsForgotPassword(false);
                  setMessage('');
                }}
                className="text-blue-600 hover:text-blue-500"
              >
                Back to sign in
              </button>
            )}
          </div>

          {message && (
            <div className={`text-center p-3 rounded ${
              message.includes('Check your email') 
                ? 'text-green-700 bg-green-100' 
                : 'text-red-700 bg-red-100'
            }`}>
              {message}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}