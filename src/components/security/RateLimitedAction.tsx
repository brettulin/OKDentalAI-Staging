
import React, { useState, useCallback, createContext, useContext } from 'react';
import { useSecurityAudit } from '@/hooks/useSecurityAudit';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface RateLimitConfig {
  maxAttempts: number;
  timeWindowMs: number;
  blockDurationMs?: number;
}

interface RateLimitState {
  attempts: Map<string, number[]>;
  blocked: Set<string>;
}

interface RateLimitContextType {
  executeAction: (
    actionKey: string, 
    action: () => Promise<void> | void,
    config?: Partial<RateLimitConfig>
  ) => Promise<boolean>;
  isBlocked: (actionKey: string) => boolean;
  getAttemptCount: (actionKey: string) => number;
}

const RateLimitContext = createContext<RateLimitContextType | null>(null);

const DEFAULT_CONFIG: RateLimitConfig = {
  maxAttempts: 5,
  timeWindowMs: 60000, // 1 minute
  blockDurationMs: 300000, // 5 minutes
};

export const RateLimitProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const { logAccess } = useSecurityAudit();
  const [rateLimitState, setRateLimitState] = useState<RateLimitState>({
    attempts: new Map(),
    blocked: new Set(),
  });

  const executeAction = useCallback(async (
    actionKey: string,
    action: () => Promise<void> | void,
    config: Partial<RateLimitConfig> = {}
  ): Promise<boolean> => {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };
    const now = Date.now();
    
    // Check if action is currently blocked
    if (rateLimitState.blocked.has(actionKey)) {
      toast.error('This action is temporarily blocked due to rate limiting.');
      return false;
    }

    // Get recent attempts for this action
    const attempts = rateLimitState.attempts.get(actionKey) || [];
    const recentAttempts = attempts.filter(time => now - time < finalConfig.timeWindowMs);

    // Check if rate limit exceeded
    if (recentAttempts.length >= finalConfig.maxAttempts) {
      // Block the action
      setRateLimitState(prev => ({
        ...prev,
        blocked: new Set([...prev.blocked, actionKey])
      }));

      // Log rate limiting event
      await logAccess({
        action_type: 'rate_limit_exceeded',
        resource_type: 'user_action',
        resource_id: actionKey,
        metadata: {
          action_key: actionKey,
          attempts_in_window: recentAttempts.length,
          max_attempts: finalConfig.maxAttempts,
          time_window_ms: finalConfig.timeWindowMs,
          user_id: profile?.user_id,
          blocked_until: new Date(now + finalConfig.blockDurationMs).toISOString()
        }
      });

      toast.error(`Rate limit exceeded for this action. Blocked for ${Math.round(finalConfig.blockDurationMs / 60000)} minutes.`);

      // Unblock after block duration
      setTimeout(() => {
        setRateLimitState(prev => {
          const newBlocked = new Set(prev.blocked);
          newBlocked.delete(actionKey);
          return {
            ...prev,
            blocked: newBlocked,
            attempts: new Map(prev.attempts).set(actionKey, []) // Reset attempts
          };
        });
      }, finalConfig.blockDurationMs);

      return false;
    }

    // Record this attempt
    setRateLimitState(prev => ({
      ...prev,
      attempts: new Map(prev.attempts).set(actionKey, [...recentAttempts, now])
    }));

    try {
      // Log action attempt
      await logAccess({
        action_type: 'rate_limited_action_attempt',
        resource_type: 'user_action',
        resource_id: actionKey,
        metadata: {
          action_key: actionKey,
          attempt_number: recentAttempts.length + 1,
          user_id: profile?.user_id,
          timestamp: new Date().toISOString()
        }
      });

      // Execute the action
      await action();

      // Log successful action
      await logAccess({
        action_type: 'rate_limited_action_success',
        resource_type: 'user_action',
        resource_id: actionKey,
        metadata: {
          action_key: actionKey,
          user_id: profile?.user_id,
          timestamp: new Date().toISOString()
        }
      });

      return true;
    } catch (error) {
      // Log failed action
      await logAccess({
        action_type: 'rate_limited_action_failed',
        resource_type: 'user_action',
        resource_id: actionKey,
        metadata: {
          action_key: actionKey,
          user_id: profile?.user_id,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      });

      console.error(`Rate limited action ${actionKey} failed:`, error);
      throw error;
    }
  }, [rateLimitState, profile?.user_id, logAccess]);

  const isBlocked = useCallback((actionKey: string): boolean => {
    return rateLimitState.blocked.has(actionKey);
  }, [rateLimitState.blocked]);

  const getAttemptCount = useCallback((actionKey: string): number => {
    const attempts = rateLimitState.attempts.get(actionKey) || [];
    const now = Date.now();
    return attempts.filter(time => now - time < DEFAULT_CONFIG.timeWindowMs).length;
  }, [rateLimitState.attempts]);

  return (
    <RateLimitContext.Provider value={{ executeAction, isBlocked, getAttemptCount }}>
      {children}
    </RateLimitContext.Provider>
  );
};

export const useRateLimit = () => {
  const context = useContext(RateLimitContext);
  if (!context) {
    throw new Error('useRateLimit must be used within a RateLimitProvider');
  }
  return context;
};

// Simplified HOC that doesn't use forwardRef to avoid TypeScript issues
export const withRateLimit = <P extends object>(
  Component: React.ComponentType<P>,
  actionKey: string,
  config?: Partial<RateLimitConfig>
) => {
  const WrappedComponent = (props: P) => (
    <RateLimitProvider>
      <Component {...props} />
    </RateLimitProvider>
  );
  
  WrappedComponent.displayName = `withRateLimit(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
};
