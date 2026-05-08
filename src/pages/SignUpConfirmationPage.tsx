import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Mail, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import env from '../lib/env';
import { getAuthEmailConfirmEnabled } from '../lib/settings';

const SignUpConfirmationPage: React.FC = () => {
  const [enabled, setEnabled] = useState<boolean | null>(env.AUTH_EMAIL_CONFIRM_ENABLED);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const val = await getAuthEmailConfirmEnabled();
        if (mounted) setEnabled(val);
      } catch {
        // ignore and keep env default
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (enabled === false) {
    return <Navigate to="/" replace />;
  }
  return (
    <div className="min-h-screen bg-[#FEFAF8] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-xl text-center">
        <div className="mx-auto w-16 h-16 bg-maroon-100 rounded-full flex items-center justify-center">
          <Mail className="h-8 w-8 text-maroon-600" />
        </div>

        <div>
          <h2 className="text-3xl font-bold text-gray-900 font-display">
            Check your email
          </h2>
          <p className="mt-4 text-gray-600">
            We've sent you a verification link to confirm your email address. 
            Please check your inbox and click the link to complete your registration.
          </p>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Didn't receive the email? Check your spam folder or try signing up again.
          </p>
          
          <Link to="/">
            <Button 
              variant="secondary" 
              className="w-full"
            >
              Return to Home
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SignUpConfirmationPage;