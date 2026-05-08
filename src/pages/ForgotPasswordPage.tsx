import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { supabase } from '../lib/supabase';

const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setLoading(true);
    setError(null);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );
      
      if (resetError) {
        // Check if this is a rate limit error and provide a more user-friendly message
        if (resetError.message.includes('rate limit') || 
            resetError.message.includes('after') || 
            resetError.name === 'over_email_send_rate_limit') {
          throw new Error('We\'ve received your request. If an account exists with this email, you\'ll receive a password reset link shortly.');
        } else {
          throw resetError;
        }
      } else {
        setSuccess(true);
      }
    } catch (err: any) {
      console.error('Error resetting password:', err);
      setError(err instanceof Error ? err.message : 'Failed to send password reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FEFAF8] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 font-display">
            Reset your password
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Enter your email address and we'll send you a link to reset your password
          </p>
        </div>
        
        {success ? (
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl">
              <p className="font-medium">Check your email</p>
              <p className="text-sm">We've sent a password reset link to {email}</p>
              <p className="text-sm mt-2">If you don't see the email, please check your spam folder.</p>
              <p className="text-sm mt-2">For security reasons, we don't confirm whether an email exists in our system.</p>
            </div>
            <p></p>
            <Link to="/signin">
              <Button variant="secondary" className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Sign In
              </Button>
            </Link>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Input
                label="Email Address"
                type="email"
                required
                icon={<Mail className="h-5 w-5" />}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Enter the email address associated with your account, and we'll send you a link to reset your password if the account exists.
              </p>
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              size="lg"
              isLoading={loading}
              disabled={loading}
              title="Send password reset link"
            >
              Send Reset Link
            </Button>

            <div className="text-center">
              <Link to="/signin" className="text-sm font-medium text-maroon-600 hover:text-maroon-500 transition-colors">
                Back to sign in
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordPage;