import React from 'react';
import { useSecurity } from '@/components/security/SecurityProvider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RateLimitedActionProps {
  action: string;
  limit?: number;
  windowMinutes?: number;
  onSuccess?: () => void;
  onRateLimit?: () => void;
  children: (executeAction: () => Promise<void>) => React.ReactNode;
}

export const RateLimitedAction: React.FC<RateLimitedActionProps> = ({
  action,
  limit = 10,
  windowMinutes = 60,
  onSuccess,
  onRateLimit,
  children
}) => {
  const { logSecurityEvent } = useSecurity();

  const executeAction = async () => {
    try {
      // Check rate limit
      const { data: canProceed, error } = await supabase.rpc('check_rate_limit', {
        p_action_type: action,
        p_limit: limit,
        p_window_minutes: windowMinutes
      });

      if (error) throw error;

      if (!canProceed) {
        // Rate limit exceeded
        await logSecurityEvent('rate_limit_exceeded', 'action', undefined);
        toast.error(`Rate limit exceeded. Please wait before trying again.`);
        onRateLimit?.();
        return;
      }

      // Log the action
      await logSecurityEvent(action, 'action', undefined);
      
      // Execute the action
      onSuccess?.();
      
    } catch (error: any) {
      console.error('Rate limited action error:', error);
      toast.error('Action failed due to security restrictions');
    }
  };

  return <>{children(executeAction)}</>;
};

// Higher-order component for rate-limited hooks
export const withRateLimit = <T extends any[]>(
  hookFn: (...args: T) => any,
  action: string,
  limit: number = 10,
  windowMinutes: number = 60
) => {
  return (...args: T) => {
    const originalHook = hookFn(...args);
    const { logSecurityEvent } = useSecurity();

    const rateLimitedMutate = async (variables: any) => {
      try {
        // Check rate limit
        const { data: canProceed, error } = await supabase.rpc('check_rate_limit', {
          p_action_type: action,
          p_limit: limit,
          p_window_minutes: windowMinutes
        });

        if (error) throw error;

        if (!canProceed) {
          await logSecurityEvent('rate_limit_exceeded', 'action', undefined);
          toast.error(`Rate limit exceeded. Please wait before trying again.`);
          return;
        }

        // Log the action
        await logSecurityEvent(action, 'action', undefined);
        
        // Execute original mutation
        return originalHook.mutate(variables);
        
      } catch (error: any) {
        console.error('Rate limited mutation error:', error);
        toast.error('Action failed due to security restrictions');
      }
    };

    return {
      ...originalHook,
      mutate: rateLimitedMutate,
      mutateAsync: rateLimitedMutate
    };
  };
};