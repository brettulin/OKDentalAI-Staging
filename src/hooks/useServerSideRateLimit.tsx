import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface RateLimitOptions {
  action: string;
  identifier?: string;
  limit?: number;
  windowMinutes?: number;
}

export const useServerSideRateLimit = () => {
  // Check rate limit using server-side edge function
  const checkRateLimit = useCallback(async (options: RateLimitOptions): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('security-rate-limiter', {
        body: {
          action: options.action,
          identifier: options.identifier,
          limit: options.limit || 10,
          windowMinutes: options.windowMinutes || 60
        }
      });

      if (error) {
        console.error('Rate limit check failed:', error);
        // Fail closed - deny if we can't check
        return false;
      }

      return data?.allowed === true;
    } catch (error) {
      console.error('Rate limit check error:', error);
      // Fail closed - deny if error occurs
      return false;
    }
  }, []);

  // Rate limit specific actions with preset limits
  const checkAuthRateLimit = useCallback(async (identifier?: string): Promise<boolean> => {
    return checkRateLimit({
      action: 'auth_attempt',
      identifier,
      limit: 5,
      windowMinutes: 15
    });
  }, [checkRateLimit]);

  const checkPMSRateLimit = useCallback(async (identifier?: string): Promise<boolean> => {
    return checkRateLimit({
      action: 'pms_operation',
      identifier,
      limit: 10,
      windowMinutes: 60
    });
  }, [checkRateLimit]);

  const checkDataExportRateLimit = useCallback(async (identifier?: string): Promise<boolean> => {
    return checkRateLimit({
      action: 'data_export',
      identifier,
      limit: 3,
      windowMinutes: 24 * 60 // 24 hours
    });
  }, [checkRateLimit]);

  const checkPatientAccessRateLimit = useCallback(async (identifier?: string): Promise<boolean> => {
    return checkRateLimit({
      action: 'patient_access',
      identifier,
      limit: 100,
      windowMinutes: 60
    });
  }, [checkRateLimit]);

  return {
    checkRateLimit,
    checkAuthRateLimit,
    checkPMSRateLimit,
    checkDataExportRateLimit,
    checkPatientAccessRateLimit
  };
};