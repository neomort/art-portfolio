import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase, signIn, signUp, updateProfile, fetchProfile } from '../lib/supabase';
import { User } from '../types';
import { env } from '../lib/env';
// Removed legacy pending inquiry flow

interface AuthContextType {
  user: User | null;
  sessionUser: User | null;
  impersonatedUser: User | null;
  isImpersonating: boolean;
  startImpersonation: (user: User) => void;
  stopImpersonation: () => void;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ data: any; error: any }>;
  signUp: (email: string, password: string, fullName: string, companyName?: string) => Promise<{ data: any; error: any }>;
  signOut: () => Promise<void>;
  updateProfile: (userId: string, updates: any) => Promise<{ data: any; error: any }>;
  checkSessionStatus: () => Promise<boolean>;
  refreshSession: () => Promise<boolean>;
  handleOAuthLogin: (provider: 'google' | 'facebook' | 'azure') => Promise<void>;
  passwordNeeded: boolean;
  setPasswordNeeded: (v: boolean) => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // no-op

  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordNeeded, setPasswordNeeded] = useState<boolean>(false);
  const [impersonatedUser, setImpersonatedUser] = useState<User | null>(null);

  const STORAGE_KEY = 'artportfolio.impersonation';

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const stored = JSON.parse(raw);
      if (!stored || typeof stored !== 'object') {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      const storedUser = stored.user as User | undefined;
      if (storedUser?.id) {
        setImpersonatedUser(storedUser);
      }
    } catch (err) {
      console.warn('[AuthContext] Failed to restore impersonation from storage', err);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const startImpersonation = (user: User) => {
    setImpersonatedUser(user);
    try {
      if (sessionUser?.id) {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ impersonatorId: sessionUser.id, user }),
        );
      }
    } catch (err) {
      console.warn('[AuthContext] Failed to persist impersonation', err);
    }
  };

  const stopImpersonation = () => {
    setImpersonatedUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.warn('[AuthContext] Failed to clear impersonation storage', err);
    }
  };

  const checkIfProfileIsIncomplete = (profile: User): boolean => {
    // With business_type now org-scoped, only check phone here.
    return (!profile.phone || profile.phone.trim() === '');
  };

  const clearSupabaseTokens = () => {
    try {
      if (env.VITE_SUPABASE_URL) {
        const urlParts = env.VITE_SUPABASE_URL.split('//')[1]?.split('.')[0];
        if (urlParts) {
          const specificKey = `sb-${urlParts}-auth-token`;
          localStorage.removeItem(specificKey);
        }
      }
      Object.keys(localStorage).forEach(key => {
        if (key.match(/^sb-.*-auth-token$/)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Error clearing Supabase tokens:', error);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setSessionUser(null);
      setImpersonatedUser(null);
      clearSupabaseTokens();
    }
  };

  const checkSessionStatus = async (): Promise<boolean> => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      return !error && !!session;
    } catch {
      return false;
    }
  };

  const refreshSession = async (): Promise<boolean> => {
    try {
      // Get current session to extract refresh token
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (currentSession?.refresh_token) {
        // Use the current refresh token to refresh the session
        const { data: { session }, error } = await supabase.auth.refreshSession({
          refresh_token: currentSession.refresh_token
        });
        return !error && !!session;
      } else {
        // Try without refresh token (for newer Supabase versions that handle it automatically)
        const { data: { session }, error } = await supabase.auth.refreshSession();
        return !error && !!session;
      }
    } catch {
      return false;
    }
  };

  const handleOAuthLogin = async (provider: 'google' | 'facebook' | 'azure') => {
    const baseUrl = env.VITE_FRONTEND_URL || window.location.origin;
    await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: baseUrl } });
  };

  useEffect(() => {
    let mounted = true;
    let authListener: ReturnType<typeof supabase.auth.onAuthStateChange>['data'] | null = null;

    const initializeAuth = async () => {
      try {
        setLoading(true);
        console.log('[AuthContext] Initializing auth listener...');

        // Helper to apply a session to local state quickly, then merge profile
        const applySession = async (session: any) => {
          if (!mounted) return;
          try {
            if (session?.user) {
              // Fast path: minimal user so UI can render
              setSessionUser({
                id: session.user.id,
                email: session.user.email ?? '',
                full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
                is_admin: false,
                needsProfileCompletion: true,
                phone: '',
                business_type: ''
              } as User);

              // Background merge of full profile (includes is_admin) - fire-and-forget
              (async () => {
                try {
                  const { data: profile } = await fetchProfile(session.user.id);
                  if (profile && mounted) {
                    setSessionUser((prev) => {
                      if (!prev) return prev;
                      const merged = {
                        ...prev,
                        ...profile,
                        email: profile.email || prev.email,
                        full_name: profile.full_name || prev.full_name,
                      } as User;
                      const mergedWithFlags = {
                        ...merged,
                        needsProfileCompletion: checkIfProfileIsIncomplete(merged),
                      } as User;
                      // Determine if password is needed (light account)
                      try {
                        const needsPwd = (profile as any)?.password_set === false;
                        setPasswordNeeded(!!needsPwd);
                      } catch {}
                      return mergedWithFlags;
                    });
                  }
                } catch (pfErr) {
                  console.warn('[AuthContext] Failed to fetch profile; continuing with session-only user', pfErr);
                }
              })();
            } else {
              setSessionUser(null);
            }
          } catch (e) {
            console.error('Error applying session:', e);
            setSessionUser(null);
          }
        };

        // Set up the auth state listener
        const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (!mounted) return;

          console.log(`[AuthContext] Auth event: ${event}`, { hasSession: !!session });

          try {
            await applySession(session);
          } finally {
            if (mounted) setLoading(false);
          }
        });

        authListener = listener;

        console.log('[AuthContext] Auth listener setup complete');

        // Immediately fetch and apply the current session so we don't wait for an event
        try {
          const { data: { session } } = await supabase.auth.getSession();
          await applySession(session);
        } catch (e) {
          console.warn('[AuthContext] getSession failed:', e);
          setSessionUser(null);
        } finally {
          if (mounted) setLoading(false);
        }
      } catch (error) {
        console.error('Failed to initialize auth listener:', error);
        if (mounted) {
          console.log('[AuthContext] Setting loading to false due to error');
          setLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
      try {
        // Properly unsubscribe from auth listener
        authListener?.subscription?.unsubscribe?.();
      } catch {}
    };
  }, []);

  // Post-login flush of pending questionnaire answers
  useEffect(() => {
    if (!sessionUser?.id) return;
    (async () => {
      try {
        const raw = localStorage.getItem('pendingSurveyAnswers');
        if (!raw) return;
        const answers = JSON.parse(raw);
        if (Array.isArray(answers) && answers.length > 0) {
          await (supabase as any).from('profiles').update({ survey_answers: answers }).eq('id', sessionUser.id);
          localStorage.removeItem('pendingSurveyAnswers');
        }
      } catch (e) {
        console.warn('Post-login survey flush failed:', e);
      }
    })();
  }, [sessionUser?.id]);

  // Legacy pending inquiry claim removed

  // Post-login flush for pending Brevo opt-in
  useEffect(() => {
    if (!sessionUser?.id) return;
    (async () => {
      try {
        const raw = localStorage.getItem('pendingBrevoOptIn');
        if (!raw) return;
        const payload = JSON.parse(raw);
        if (payload && payload.optIn === true) {
          const ts = typeof payload.ts === 'string' ? payload.ts : new Date().toISOString();
          await (supabase as any)
            .from('profiles')
            .update({ brevo_opt_in: true, brevo_opt_in_ts: ts })
            .eq('id', sessionUser.id);
          localStorage.removeItem('pendingBrevoOptIn');
        }
      } catch (e) {
        console.warn('Post-login Brevo opt-in flush failed:', e);
      }
    })();
  }, [sessionUser?.id]);

  useEffect(() => {
    if (!sessionUser) {
      setImpersonatedUser(null);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
      return;
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        if (impersonatedUser) {
          setImpersonatedUser(null);
        }
        return;
      }

      const stored = JSON.parse(raw);
      if (!stored || typeof stored !== 'object') {
        localStorage.removeItem(STORAGE_KEY);
        setImpersonatedUser(null);
        return;
      }

      if (stored.impersonatorId && stored.impersonatorId !== sessionUser.id) {
        stopImpersonation();
        return;
      }

      const storedUser = stored.user as User | undefined;
      if (storedUser?.id && storedUser.id !== sessionUser.id) {
        setImpersonatedUser(storedUser);
      } else {
        stopImpersonation();
      }
    } catch (err) {
      console.warn('[AuthContext] Failed to reconcile impersonation state', err);
      stopImpersonation();
    }
  }, [sessionUser?.id]);

  const effectiveUser = impersonatedUser ?? sessionUser;

  const value = {
    user: effectiveUser,
    sessionUser,
    impersonatedUser,
    isImpersonating: !!impersonatedUser,
    startImpersonation,
    stopImpersonation,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile,
    checkSessionStatus,
    refreshSession,
    handleOAuthLogin,
    passwordNeeded,
    setPasswordNeeded,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};