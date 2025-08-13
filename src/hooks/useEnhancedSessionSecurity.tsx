import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface DeviceInfo {
  userAgent: string;
  platform: string;
  language: string;
  timezone: string;
  screen: string;
}

interface SessionSecurity {
  isValid: boolean;
  deviceTrusted: boolean;
  lastActivity: Date | null;
  timeoutWarning: boolean;
}

export const useEnhancedSessionSecurity = () => {
  const { user } = useAuth();
  const [sessionSecurity, setSessionSecurity] = useState<SessionSecurity>({
    isValid: true,
    deviceTrusted: true,
    lastActivity: null,
    timeoutWarning: false
  });
  const [sessionTimeoutId, setSessionTimeoutId] = useState<NodeJS.Timeout | null>(null);

  // Generate device fingerprint
  const generateDeviceFingerprint = useCallback((): string => {
    const deviceInfo: DeviceInfo = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screen: `${screen.width}x${screen.height}x${screen.colorDepth}`
    };

    return btoa(JSON.stringify(deviceInfo));
  }, []);

  // Validate session with server
  const validateSession = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    try {
      const { data, error } = await supabase.functions.invoke('security-session-manager', {
        body: {
          action: 'validate',
          deviceFingerprint: generateDeviceFingerprint()
        }
      });

      if (error) {
        console.error('Session validation failed:', error);
        return false;
      }

      const isValid = data?.valid === true;
      setSessionSecurity(prev => ({
        ...prev,
        isValid
      }));

      return isValid;
    } catch (error) {
      console.error('Session validation error:', error);
      return false;
    }
  }, [user, generateDeviceFingerprint]);

  // Check device trust status
  const checkDeviceTrust = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    try {
      const { data, error } = await supabase.functions.invoke('security-session-manager', {
        body: {
          action: 'check_device',
          deviceFingerprint: generateDeviceFingerprint()
        }
      });

      if (error) {
        console.error('Device trust check failed:', error);
        return true; // Default to trusted if check fails
      }

      const isTrusted = !data?.suspicious;
      setSessionSecurity(prev => ({
        ...prev,
        deviceTrusted: isTrusted
      }));

      return isTrusted;
    } catch (error) {
      console.error('Device trust check error:', error);
      return true; // Default to trusted if error occurs
    }
  }, [user, generateDeviceFingerprint]);

  // Track user activity
  const trackActivity = useCallback(async (activityType: string = 'interaction') => {
    if (!user) return;

    try {
      await supabase.functions.invoke('security-session-manager', {
        body: {
          action: 'track_activity',
          activityData: {
            type: activityType,
            timestamp: new Date().toISOString(),
            page: window.location.pathname
          }
        }
      });

      setSessionSecurity(prev => ({
        ...prev,
        lastActivity: new Date()
      }));

      // Reset session timeout
      if (sessionTimeoutId) {
        clearTimeout(sessionTimeoutId);
      }

      // Set new timeout (30 minutes of inactivity)
      const newTimeoutId = setTimeout(() => {
        setSessionSecurity(prev => ({
          ...prev,
          timeoutWarning: true
        }));

        // Auto-logout after additional 5 minutes of warning
        setTimeout(() => {
          invalidateSession();
        }, 5 * 60 * 1000);
      }, 30 * 60 * 1000);

      setSessionTimeoutId(newTimeoutId);
    } catch (error) {
      console.error('Activity tracking error:', error);
    }
  }, [user, sessionTimeoutId]);

  // Invalidate session
  const invalidateSession = useCallback(async () => {
    if (!user) return;

    try {
      await supabase.functions.invoke('security-session-manager', {
        body: {
          action: 'invalidate'
        }
      });

      // Clear local session state
      setSessionSecurity({
        isValid: false,
        deviceTrusted: false,
        lastActivity: null,
        timeoutWarning: false
      });

      // Sign out user
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Session invalidation error:', error);
      // Force signout even if server call fails
      await supabase.auth.signOut();
    }
  }, [user]);

  // Extend session (clear timeout warning)
  const extendSession = useCallback(() => {
    setSessionSecurity(prev => ({
      ...prev,
      timeoutWarning: false
    }));
    trackActivity('session_extended');
  }, [trackActivity]);

  // Set up activity listeners
  useEffect(() => {
    if (!user) return;

    const handleActivity = () => {
      trackActivity('user_interaction');
    };

    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Initial session validation
    validateSession();
    checkDeviceTrust();

    // Periodic session validation (every 5 minutes)
    const validationInterval = setInterval(() => {
      validateSession();
    }, 5 * 60 * 1000);

    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      clearInterval(validationInterval);
      if (sessionTimeoutId) {
        clearTimeout(sessionTimeoutId);
      }
    };
  }, [user, validateSession, checkDeviceTrust, trackActivity, sessionTimeoutId]);

  return {
    sessionSecurity,
    validateSession,
    checkDeviceTrust,
    trackActivity,
    invalidateSession,
    extendSession,
    generateDeviceFingerprint
  };
};