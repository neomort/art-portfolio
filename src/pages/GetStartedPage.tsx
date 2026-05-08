import React, { useState } from 'react';
import { usePageHeaderTitle } from '../lib/usePageTitle';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, User } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useAuth } from '../contexts/AuthContext';
import env from '../lib/env';
import { getAuthEmailConfirmEnabled } from '../lib/settings';
import { supabase } from '../lib/supabase';

const GetStartedPage: React.FC = () => {
  usePageHeaderTitle('Get Started');
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optIn, setOptIn] = useState<boolean>(true);

  // Questionnaire state
  const [region, setRegion] = useState('');
  const [businessTypes, setBusinessTypes] = useState(''); // comma-separated list

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      setLoading(false);
      return;
    }

    try {
      const { error } = await signUp(
        formData.email,
        formData.password,
        formData.fullName
      );
      if (error) throw error;

      // Fire-and-forget Brevo contact creation if user opted in
      // Note: This currently runs on sign-up success. If you prefer to only add
      // after email confirmation, we can move this to a post-confirmation hook.
      if (optIn) {
        const optInTs = new Date().toISOString();
        try {
          await supabase.functions.invoke('add-brevo-contact', {
            body: {
              email: formData.email,
              firstName: formData.fullName?.split(' ')?.[0] || '',
              lastName: formData.fullName?.split(' ')?.slice(1)?.join(' ') || '',
              consentText: 'Get exclusive tips and updates on new features',
            },
          });
        } catch (e) {
          // Non-blocking: do not disrupt signup flow if this fails
          // eslint-disable-next-line no-console
          console.warn('Brevo contact add failed (non-blocking):', e);
        }

        // Attempt to persist opt-in to the user's profile if session is available
        try {
          const { data: u } = await supabase.auth.getUser();
          const userId = u?.user?.id;
          if (userId) {
            await (supabase as any)
              .from('profiles')
              .update({ brevo_opt_in: true, brevo_opt_in_ts: optInTs })
              .eq('id', userId);
          } else {
            // No session yet (email confirmation flow). Stash locally; we will upsert after first login.
            localStorage.setItem('pendingBrevoOptIn', JSON.stringify({ optIn: true, ts: optInTs }));
          }
        } catch (e) {
          // Non-blocking
          // eslint-disable-next-line no-console
          console.warn('Failed to persist Brevo opt-in (non-blocking):', e);
          localStorage.setItem('pendingBrevoOptIn', JSON.stringify({ optIn: true, ts: optInTs }));
        }
      }

      // Try to persist questionnaire answers to the user's profile
      try {
        const answers: string[] = [];
        if (region.trim()) answers.push(`region: ${region.trim()}`);
        if (businessTypes.trim()) {
          const parts = businessTypes
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
          if (parts.length) {
            answers.push(`business_types: ${parts.join('|')}`);
          }
        }
        if (answers.length) {
          const { data: u } = await supabase.auth.getUser();
          const userId = u?.user?.id;
          if (userId) {
            await (supabase as any).from('profiles').upsert({ id: userId, survey_answers: answers }, { onConflict: 'id' });
          } else {
            // No session yet (email confirmation flow). Stash locally; we can upsert after first login.
            localStorage.setItem('pendingSurveyAnswers', JSON.stringify(answers));
          }
        }
      } catch (e) {
        // Non-blocking
        // eslint-disable-next-line no-console
        console.warn('Failed to persist survey answers (non-blocking):', e);
      }

      let enabled = env.AUTH_EMAIL_CONFIRM_ENABLED;
      try {
        enabled = await getAuthEmailConfirmEnabled();
      } catch {
        // ignore, use env fallback
      }
      navigate(enabled ? '/signup/confirmation' : '/');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sign up';
      if (
        errorMessage.includes('already registered') ||
        errorMessage.includes('User already registered') ||
        errorMessage.includes('duplicate key value') ||
        errorMessage.includes('email already exists') ||
        errorMessage.includes('Email rate limit exceeded') ||
        errorMessage.toLowerCase().includes('user with this email')
      ) {
        setError('An account with this email already exists — try signing in instead.');
      } else if (errorMessage.includes('weak_password') || errorMessage.includes('pwned')) {
        setError('This password has been found in data breaches and is not secure. Please choose a stronger, unique password.');
      } else if (errorMessage.includes('email_address_invalid')) {
        setError('Please enter a valid email address.');
      } else if (errorMessage.includes('signup_disabled')) {
        setError('Account registration is currently disabled. Please contact support.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FEFAF8] pt-6 sm:pt-8 lg:pt-10 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Questionnaire: top on mobile, right on desktop */}
        <div className="order-1 lg:order-2 bg-white p-6 sm:p-8 rounded-2xl shadow-xl">
          <h3 className="text-xl font-semibold text-gray-900 font-display mb-4">Tell us about your goals</h3>
          <div className="space-y-4">
            <Input
              label="In what primary geographical region are you interested in conducting business?"
              type="text"
              placeholder="Enter a city, state, country, or zip code"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            />
            <Input
              label="What types of business are you interested in partnering with?"
              type="text"
              value={businessTypes}
              onChange={(e) => setBusinessTypes(e.target.value)}
            />
          </div>
        </div>

        {/* Sign-up card */}
        <div className="order-2 lg:order-1 max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-xl justify-self-center">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 font-display">
              Get started
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Already have an account?{' '}
              <Link to="/signin" className="font-medium text-maroon-600 hover:text-maroon-500">
                Sign in
              </Link>
            </p>
          </div>

          {/* OAUTH BUTTONS */}
          <div className="space-y-3 mb-6">
            <Button
              type="button"
              variant="outline"
              className="inline-flex items-center justify-center font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none border-2 active:bg-[#fff0e0] transition-colors duration-200 font-sans h-11 px-8 text-sm w-full bg-white hover:bg-gray-50 border-gray-300 text-gray-700"
              size="lg"
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                setError(null);
                try {
                  const baseUrl = env.VITE_FRONTEND_URL || (typeof window !== 'undefined' ? window.location.origin : '');
                  const redirectTo = optIn ? `${baseUrl}/?optin=1` : `${baseUrl}/`;
                  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
                  if (error) throw error;
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to sign up with provider');
                } finally {
                  setLoading(false);
                }
              }}
              aria-label="Sign up with Google"
            >
              <div className="flex items-center justify-center">
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"></path>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"></path>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"></path>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"></path>
                </svg>
                <span>Sign up with Google</span>
              </div>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="inline-flex items-center justify-center font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none border-2 active:bg-[#fff0e0] transition-colors duration-200 font-sans h-11 px-8 text-sm w-full bg-white hover:bg-gray-50 border-gray-300 text-gray-700"
              size="lg"
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                setError(null);
                try {
                  const baseUrl = env.VITE_FRONTEND_URL || (typeof window !== 'undefined' ? window.location.origin : '');
                  const redirectTo = optIn ? `${baseUrl}/?optin=1` : `${baseUrl}/`;
                  const { error } = await supabase.auth.signInWithOAuth({ provider: 'facebook', options: { redirectTo } });
                  if (error) throw error;
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to sign up with provider');
                } finally {
                  setLoading(false);
                }
              }}
              aria-label="Sign up with Facebook"
            >
              <div className="flex items-center justify-center">
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="#1877F2" aria-hidden="true">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"></path>
                </svg>
                <span>Sign up with Facebook</span>
              </div>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="inline-flex items-center justify-center font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none border-2 active:bg-[#fff0e0] transition-colors duration-200 font-sans h-11 px-8 text-sm w-full bg-white hover:bg-gray-50 border-gray-300 text-gray-700"
              size="lg"
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                setError(null);
                try {
                  const baseUrl = env.VITE_FRONTEND_URL || (typeof window !== 'undefined' ? window.location.origin : '');
                  const redirectTo = optIn ? `${baseUrl}/?optin=1` : `${baseUrl}/`;
                  const { error } = await supabase.auth.signInWithOAuth({ provider: 'azure', options: { redirectTo } });
                  if (error) throw error;
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to sign up with provider');
                } finally {
                  setLoading(false);
                }
              }}
              aria-label="Sign up with Microsoft"
            >
              <div className="flex items-center justify-center">
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#F25022" d="M0 0h11.377v11.372H0z"></path>
                  <path fill="#00A4EF" d="M12.623 0H24v11.372H12.623z"></path>
                  <path fill="#7FBA00" d="M0 12.628h11.377V24H0z"></path>
                  <path fill="#FFB900" d="M12.623 12.628H24V24H12.623z"></path>
                </svg>
                <span>Sign up with Microsoft</span>
              </div>
            </Button>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-2 text-gray-400">or</span>
            </div>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <Input
                label="Full Name"
                type="text"
                required
                icon={<User className="h-5 w-5" />}
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              />

              <Input
                label="Email Address"
                type="email"
                required
                icon={<Mail className="h-5 w-5" />}
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />

              <Input
                label="Password"
                type="password"
                required
                minLength={8}
                icon={<Lock className="h-5 w-5" />}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Choose a strong, unique password"
              />
              <div className="text-xs text-gray-500 mt-1">
                Password must be at least 8 characters and not found in data breaches
              </div>

              {/* Opt-in checkbox */}
              <label className="flex items-start gap-3 select-none cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 text-maroon-600 border-2 border-maroon-300 rounded-lg focus:ring-2 focus:ring-maroon-500"
                  checked={optIn}
                  onChange={(e) => setOptIn(e.target.checked)}
                />
                <span className="text-sm text-gray-700 leading-6">
                  Get exclusive tips and updates on new features
                </span>
              </label>
            </div>

            <Button
              type="submit"
              className="w-full bg-[#d85151] hover:bg-[#c14848] active:bg-[#a93e3e] text-white"
              size="lg"
              isLoading={loading}
            >
              Create Account
            </Button>

            <p className="text-xs text-center text-gray-600">
              By signing up, you agree to our{' '}
              <Link to="/terms" className="text-maroon-600 hover:text-maroon-500">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link to="/privacy" className="text-maroon-600 hover:text-maroon-500">
                Privacy Policy
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default GetStartedPage;
