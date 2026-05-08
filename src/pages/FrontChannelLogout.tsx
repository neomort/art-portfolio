import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// Front-channel logout endpoint for IdPs (e.g., Microsoft)
// This page is intended to be loaded in a hidden iframe by the IdP.
// It should clear the local application session and return 200 quickly.
const FrontChannelLogout: React.FC = () => {
  const [done, setDone] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const clearSupabaseTokens = () => {
      try {
        // Remove specific sb-* auth tokens
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && /^sb-.*-auth-token$/.test(key)) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key));

        // Remove any other supabase-related storage items as a best-effort cleanup
        const supabaseKeys = Object.keys(localStorage).filter(
          (key) => key.startsWith('supabase.') || key.includes('supabase')
        );
        supabaseKeys.forEach((key) => localStorage.removeItem(key));
      } catch (e) {
        // Ignore
      }
    };

    const run = async () => {
      try {
        // Best-effort server sign-out (may fail in iframe/cross-origin context)
        await supabase.auth.signOut();
      } catch (e) {
        // ignore
      } finally {
        clearSupabaseTokens();
        if (isMounted) setDone(true);
      }
    };

    run();
    return () => {
      isMounted = false;
    };
  }, []);

  // Minimal content for iframe context
  return (
    <div style={{ padding: 8, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial' }}>
      {done ? 'OK' : 'Signing out...'}
    </div>
  );
};

export default FrontChannelLogout;
