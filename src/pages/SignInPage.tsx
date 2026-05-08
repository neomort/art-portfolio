import React, { useState } from 'react';
import { usePageHeaderTitle } from '../lib/usePageTitle';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from 'react-router-dom';

const SignInPage: React.FC = () => {
  usePageHeaderTitle('Sign In');
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, handleOAuthLogin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await signIn(formData.email, formData.password);
      if (error) throw error;
      
      // Check if user needs to complete their profile
      if (data?.profile?.needsProfileCompletion) {
        navigate('/profile');
      } else {
        // Check if there's a redirect URL in the query parameters
        const searchParams = new URLSearchParams(location.search);
        const redirectTo = searchParams.get('redirect');
        
        if (redirectTo) {
          navigate(redirectTo);
        } else {
          navigate('/');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FEFAF8] flex items-start justify-center pt-6 sm:pt-8 lg:pt-10 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 font-display">
            Welcome back
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Don't have an account?{' '}
            <Link to="/signup" className="font-medium text-maroon-600 hover:text-maroon-500">
              Sign up
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
            onClick={() => handleOAuthLogin('google')}
            aria-label="Sign in with Google"
          >
            <div className="flex items-center justify-center">
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"></path>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"></path>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"></path>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"></path>
              </svg>
              <span>Sign in with Google</span>
            </div>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="inline-flex items-center justify-center font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none border-2 active:bg-[#fff0e0] transition-colors duration-200 font-sans h-11 px-8 text-sm w-full bg-white hover:bg-gray-50 border-gray-300 text-gray-700"
            size="lg"
            disabled={loading}
            onClick={() => handleOAuthLogin('facebook')}
            aria-label="Sign in with Facebook"
          >
            <div className="flex items-center justify-center">
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="#1877F2" aria-hidden="true">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"></path>
              </svg>
              <span>Sign in with Facebook</span>
            </div>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="inline-flex items-center justify-center font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none border-2 active:bg-[#fff0e0] transition-colors duration-200 font-sans h-11 px-8 text-sm w-full bg-white hover:bg-gray-50 border-gray-300 text-gray-700"
            size="lg"
            disabled={loading}
            onClick={() => handleOAuthLogin('azure')}
            aria-label="Sign in with Microsoft"
          >
            <div className="flex items-center justify-center">
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#F25022" d="M0 0h11.377v11.372H0z"></path>
                <path fill="#00A4EF" d="M12.623 0H24v11.372H12.623z"></path>
                <path fill="#7FBA00" d="M0 12.628h11.377V24H0z"></path>
                <path fill="#FFB900" d="M12.623 12.628H24V24H12.623z"></path>
              </svg>
              <span>Sign in with Microsoft</span>
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
              icon={<Lock className="h-5 w-5" />}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm">
              <Link to="/forgot-password" className="font-medium text-maroon-600 hover:text-maroon-500 transition-colors">
                Forgot your password?
              </Link>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-[#d85151] hover:bg-[#c14848] active:bg-[#a93e3e] text-white"
            size="lg"
            isLoading={loading}
          >
            Sign In
          </Button>
        </form>

      </div>
    </div>
  );
};

export default SignInPage;