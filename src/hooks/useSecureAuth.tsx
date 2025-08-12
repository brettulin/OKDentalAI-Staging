import { useState, useEffect, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useSecurityAudit } from './useSecurityAudit';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

export const useSecureAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true
  });
  const { logAccess } = useSecurityAudit();
  const sessionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Session timeout for sensitive operations (30 minutes)
  const SESSION_TIMEOUT = 30 * 60 * 1000;

  // Reset session timeout on user activity
  const resetSessionTimeout = () => {
    lastActivityRef.current = Date.now();
    
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current);
    }

    sessionTimeoutRef.current = setTimeout(() => {
      if (authState.session) {
        console.warn('Session timeout reached for sensitive operations');
        // In production, you might want to force re-authentication
        // or redirect to a session timeout page
      }
    }, SESSION_TIMEOUT);
  };

  // Track user activity
  useEffect(() => {
    const handleActivity = () => resetSessionTimeout();
    
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
      if (sessionTimeoutRef.current) {
        clearTimeout(sessionTimeoutRef.current);
      }
    };
  }, [authState.session]);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Only synchronous state updates here to prevent deadlocks
        setAuthState({
          user: session?.user ?? null,
          session,
          loading: false
        });

        // Defer async operations with setTimeout to prevent deadlocks
        if (session?.user && event === 'SIGNED_IN') {
          setTimeout(() => {
            logAccess({
              action_type: 'user_login',
              resource_type: 'auth',
              metadata: {
                event,
                timestamp: new Date().toISOString(),
                user_agent: navigator.userAgent
              }
            });
            resetSessionTimeout();
          }, 0);
        } else if (event === 'SIGNED_OUT') {
          setTimeout(() => {
            logAccess({
              action_type: 'user_logout',
              resource_type: 'auth',
              metadata: {
                event,
                timestamp: new Date().toISOString()
              }
            });
            if (sessionTimeoutRef.current) {
              clearTimeout(sessionTimeoutRef.current);
            }
          }, 0);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthState({
        user: session?.user ?? null,
        session,
        loading: false
      });

      if (session) {
        resetSessionTimeout();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    if (password) {
      // Sign in with password
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      return { error };
    } else {
      // Sign in with OTP (magic link)
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectUrl
        }
      });
      return { error };
    }
  };

  const signUp = async (email: string, password: string, metadata?: any) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: metadata
      }
    });
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  const isSessionExpired = () => {
    if (!authState.session) return true;
    
    const expiresAt = authState.session.expires_at;
    if (!expiresAt) return false;
    
    return Date.now() / 1000 > expiresAt;
  };

  const getTimeSinceLastActivity = () => {
    return Date.now() - lastActivityRef.current;
  };

  return {
    user: authState.user,
    session: authState.session,
    loading: authState.loading,
    signIn,
    signUp,
    signOut,
    isSessionExpired,
    getTimeSinceLastActivity,
    resetSessionTimeout
  };
};