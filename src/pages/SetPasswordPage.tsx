import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const SetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, setPasswordNeeded } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    try {
      setLoading(true);
      const { error: updErr } = await supabase.auth.updateUser({ password });
      if (updErr) throw updErr;

      if (!user?.id) {
        // Best-effort: navigate to org tab regardless
        navigate('/profile?tab=org');
        return;
      }

      // Mark profile as having a password
      await (supabase as any).from('profiles').update({ password_set: true }).eq('id', user.id);
      setPasswordNeeded(false);

      // Go to organization tab in profile
      navigate('/profile?tab=org');
    } catch (err: any) {
      setError(err?.message || 'Failed to set password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FEFAF8] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-maroon-800">
              <Lock className="h-5 w-5 mr-2" />
              Create a password
            </CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">{error}</div>
            )}
            <form onSubmit={onSubmit} className="space-y-4">
              <Input
                label="New password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Input
                label="Confirm password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => navigate('/dashboard')} disabled={loading}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" isLoading={loading}>
                  Save password
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SetPasswordPage;
