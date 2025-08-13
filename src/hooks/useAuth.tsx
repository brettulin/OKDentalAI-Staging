import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

// Helper function to parse URL parameters for auth errors
const parseAuthError = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const error = urlParams.get('error');
  const errorDescription = urlParams.get('error_description');
  
  if (error) {
    // Clear URL parameters after parsing
    window.history.replaceState({}, document.title, window.location.pathname);
    
    if (error === 'access_denied' || errorDescription?.includes('expired')) {
      return 'Your magic link has expired. Please request a new one.';
    }
    
    return errorDescription || 'Authentication failed. Please try again.';
  }
  
  return null;
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: any | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string) => Promise<{ error?: string }>;
  signInWithPassword: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, metadata?: any) => Promise<{ error?: string }>;
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
    // Check for auth errors in URL first
    const urlError = parseAuthError();
    if (urlError) {
      setError(urlError);
      setLoading(false);
      return;
    }

    // Set timeout to prevent infinite loading
    timeoutRef.current = setTimeout(() => {
      console.warn('Auth initialization timeout - clearing loading state');
      setLoading(false);
      setError('Authentication timeout. Please refresh the page and try again.');
    }, 8000); // Reduced to 8 seconds

    // Listen for auth changes FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        console.log('Auth state change:', event, newSession?.user?.email);
        
        // Clear timeout on any auth event
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        // Handle sign out explicitly
        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setProfile(null);
          setError(null);
          setLoading(false);
          return;
        }

        // Handle sign in events
        if (event === 'SIGNED_IN' && newSession?.user) {
          setSession(newSession);
          setUser(newSession.user);
          setError(null);
          
          // Use setTimeout to defer the fetchProfile call
          setTimeout(() => {
            fetchProfile(newSession.user.id);
          }, 0);
          return;
        }

        // Handle token refresh
        if (event === 'TOKEN_REFRESHED' && newSession) {
          setSession(newSession);
          setUser(newSession.user);
          return;
        }

        // For any other case, update state accordingly
        setSession(newSession);
        setUser(newSession?.user ?? null);
        
        if (!newSession?.user) {
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

  const signInWithPassword = async (email: string, password: string): Promise<{ error?: string }> => {
    try {
      setError(null);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        const errorMessage = error.message || 'Failed to sign in with password';
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

  const signUp = async (email: string, password: string, metadata?: any): Promise<{ error?: string }> => {
    try {
      setError(null);
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: metadata,
        },
      });
      
      if (error) {
        const errorMessage = error.message || 'Failed to create account';
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
      signInWithPassword,
      signUp,
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