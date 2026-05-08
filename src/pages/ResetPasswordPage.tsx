import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Check, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { supabase } from '../lib/supabase';

const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [sessionEstablished, setSessionEstablished] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);



  useEffect(() => {
    const handleRecovery = async () => {
      setMessage("Validating your reset link...");
      
      // Store debug info
      setDebugInfo(`URL: ${window.location.href}\nHash: ${window.location.hash}\nQuery: ${window.location.search}`);
      
      try {
        // First, check if we're coming from a password reset email
        const { data, error } = await supabase.auth.getSession();
        
        if (error) throw error;
        
        // If we have a valid session, we can proceed
        if (data?.session) {
          setSessionEstablished(true);
          setMessage("Please enter a new password.");
          return;
        }
        
        // If no session, check if we have a password recovery hash
        const hash = window.location.hash;
        if (hash && hash.includes('type=recovery')) {
          // Extract the access token and refresh token from the URL
          const params = new URLSearchParams(hash.substring(1));
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          const type = params.get('type');
          
          if (type === 'recovery' && accessToken) {
            // Set the session using the tokens from the URL
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || ''
            });
            
            if (sessionError) throw sessionError;
            
            // Clear the URL hash to prevent re-processing on re-renders
            window.history.replaceState({}, document.title, window.location.pathname);
            
            setSessionEstablished(true);
            setMessage("Please enter a new password.");
            return;
          }
        }
        
        // If we get here, no valid session or recovery tokens were found
        throw new Error("No valid session or reset token found. Please request a new password reset link.");
        
      } catch (err) {
        console.error('Password reset error:', err);
        setError(`Error: ${err instanceof Error ? err.message : 'Failed to process password reset'}`);
      }
    };

    // Delay slightly to allow hash to load on Netlify or slow routers
    setTimeout(handleRecovery, 100);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match. Please try again.");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);
    setError(null);

    if (!sessionEstablished) {
      setError("Your session has expired. Please request a new password reset link.");
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setMessage("Password updated successfully!");
      
      setTimeout(() => {
        navigate('/signin');
      }, 3000);
    } catch (err) {
      console.error('Error updating password:', err);
      setError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FEFAF8] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-2xl shadow-xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 font-display">
            Reset your password
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {sessionEstablished 
              ? "Create a new password for your account" 
              : "Validating your reset link..."}
          </p>
        </div>
        
        {/* Debug information - only shown in development */}
        {import.meta.env.DEV && debugInfo && (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-xl text-xs font-mono whitespace-pre-wrap">
            <details>
              <summary className="cursor-pointer font-medium">Debug Information</summary>
              {debugInfo}
            </details>
          </div>
        )}
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl flex items-start">
            <AlertCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}
        
        {message && (
          <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-xl flex items-start">
            <Check className="h-5 w-5 mr-2" />
            {message}
          </div>
        )}
        
        {sessionEstablished && (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-5">
              <Input
                label="New Password"
                type="password"
                required
                icon={<Lock className="h-5 w-5" />}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={6}
              />
              
              <Input
                label="Confirm New Password"
                type="password"
                required
                icon={<Lock className="h-5 w-5" />}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={6}
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-xl text-sm">
              <p className="font-medium">Password Requirements:</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>At least 6 characters long</li>
                <li>Avoid using easily guessable passwords</li>
              </ul>
            </div>

            <Button
              type="submit"
              className="w-full bg-[#d85151] hover:bg-[#c14848] active:bg-[#a93e3e] text-white"
              size="lg"
              isLoading={loading}
              disabled={!sessionEstablished || loading}
            >
              Reset Password
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;