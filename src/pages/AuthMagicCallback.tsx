import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

const AuthMagicCallback: React.FC = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(true);
  const [resent, setResent] = useState(false);

  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const token = params.get('token') || '';
  const email = params.get('email') || '';
  const next = params.get('next') || '/dashboard';

  useEffect(() => {
    const run = async () => {
      try {
        setError(null);
        setVerifying(true);

        if (!token || !email) {
          setError('Missing token or email in the URL.');
          setVerifying(false);
          return;
        }

        // Verify the OTP (magic link)
        const { error: verifyErr } = await supabase.auth.verifyOtp({
          email,
          token,
          type: 'magiclink',
        });
        if (verifyErr) {
          setError(verifyErr.message || 'Failed to verify the magic link.');
          setVerifying(false);
          return;
        }

        // Wait briefly for session propagation, then check session
        await sleep(300);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          // Retry once more after a short delay
          await sleep(700);
          const { data: { session: session2 } } = await supabase.auth.getSession();
          if (!session2) {
            setError('Sign-in succeeded but session is not available yet. Please click Finish sign-in below.');
            setVerifying(false);
            return;
          }
        }

        navigate(next || '/dashboard', { replace: true });
      } catch (e: any) {
        setError(e?.message || 'Unexpected error verifying link');
        setVerifying(false);
      }
    };
    run();
  }, [token, email, next, navigate]);

  const handleResend = async () => {
    try {
      setError(null);
      const emailRedirectTo = `${window.location.origin}${next || '/dashboard'}`;
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo },
      });
      if (otpErr) {
        setError(otpErr.message || 'Failed to resend magic link.');
      } else {
        setResent(true);
      }
    } catch (e: any) {
      setError(e?.message || 'Unexpected error while resending.');
    }
  };

  return (
    <div className="min-h-screen bg-[#FEFAF8] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow p-8 text-center">
        <h1 className="text-2xl font-bold text-maroon-800 mb-2">Signing you in…</h1>
        {verifying && (
          <>
            <p className="text-maroon-600 mb-4">Verifying your magic link for {email || 'your account'}.</p>
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-maroon-600 mx-auto" />
          </>
        )}
        {!verifying && error && (
          <>
            <p className="text-red-600 mb-4">{error}</p>
            <button
              type="button"
              onClick={handleResend}
              className="rounded-3xl font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none font-display border-2 border-[#FFD2B3] bg-transparent hover:bg-[#fff5eb] active:bg-[#fff0e0] text-gray-800 transition-colors duration-200 h-10 px-5"
            >
              Finish sign-in (resend link)
            </button>
            {resent && (
              <p className="text-sm text-maroon-600 mt-3">We sent you a new magic link.</p>
            )}
          </>
        )}
        {!verifying && !error && (
          <p className="text-maroon-600">Success. Redirecting…</p>
        )}
      </div>
    </div>
  );
};

export default AuthMagicCallback;
