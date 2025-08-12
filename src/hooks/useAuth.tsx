import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: any | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Set timeout to prevent infinite loading
    timeoutRef.current = setTimeout(() => {
      console.warn('Auth initialization timeout - clearing loading state');
      setLoading(false);
      setError('Authentication timeout. Please refresh the page.');
    }, 10000); // 10 second timeout

    // Listen for auth changes FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        console.log('Auth state change:', event, newSession?.user?.email);
        
        // Clear timeout on any auth event
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        setSession(newSession);
        setUser(newSession?.user ?? null);
        setError(null);
        
        if (newSession?.user) {
          // Use setTimeout to defer the fetchProfile call to avoid potential deadlock
          setTimeout(() => {
            fetchProfile(newSession.user.id);
          }, 0);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      if (error) {
        console.error('Session error:', error);
        setError('Failed to load session. Please try signing in again.');
        setLoading(false);
        return;
      }
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    }).catch((err) => {
      console.error('Session fetch error:', err);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setError('Failed to initialize authentication.');
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string): Promise<{ error?: string }> => {
    try {
      setError(null);
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });
      
      if (error) {
        const errorMessage = error.message || 'Failed to send magic link';
        setError(errorMessage);
        return { error: errorMessage };
      }
      
      return {};
    } catch (err) {
      const errorMessage = 'Network error. Please check your connection and try again.';
      setError(errorMessage);
      return { error: errorMessage };
    }
  };

  const signOut = async () => {
    try {
      setError(null);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (err) {
      console.error('Sign out error:', err);
      setError('Failed to sign out');
    }
  };

  const clearError = () => {
    setError(null);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      profile, 
      loading, 
      error, 
      signIn, 
      signOut, 
      clearError 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};