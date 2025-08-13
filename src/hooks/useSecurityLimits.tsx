import { useState, useRef } from 'react';

interface SecurityLimitsHook {
  isAccountLocked: boolean;
  failedAttempts: number;
  lockoutTimeRemaining: number;
  checkRateLimit: (action: string) => boolean;
  recordFailedAttempt: () => void;
  resetFailedAttempts: () => void;
  requireMagicLinkForSensitive: boolean;
  setRequireMagicLinkForSensitive: (require: boolean) => void;
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;

export const useSecurityLimits = (): SecurityLimitsHook => {
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [requireMagicLinkForSensitive, setRequireMagicLinkForSensitive] = useState(false);
  const requestCounts = useRef<Map<string, { count: number; windowStart: number }>>(new Map());

  const isAccountLocked = lockoutUntil ? Date.now() < lockoutUntil : false;
  const lockoutTimeRemaining = lockoutUntil ? Math.max(0, lockoutUntil - Date.now()) : 0;

  const checkRateLimit = (action: string): boolean => {
    const now = Date.now();
    const windowStart = Math.floor(now / RATE_LIMIT_WINDOW) * RATE_LIMIT_WINDOW;
    const key = `${action}_${windowStart}`;
    
    const current = requestCounts.current.get(key) || { count: 0, windowStart };
    
    if (current.count >= MAX_REQUESTS_PER_WINDOW) {
      return false; // Rate limit exceeded
    }
    
    requestCounts.current.set(key, { ...current, count: current.count + 1 });
    
    // Clean up old entries
    for (const [k, v] of requestCounts.current.entries()) {
      if (v.windowStart < now - RATE_LIMIT_WINDOW) {
        requestCounts.current.delete(k);
      }
    }
    
    return true;
  };

  const recordFailedAttempt = () => {
    const newFailedAttempts = failedAttempts + 1;
    setFailedAttempts(newFailedAttempts);
    
    if (newFailedAttempts >= MAX_FAILED_ATTEMPTS) {
      setLockoutUntil(Date.now() + LOCKOUT_DURATION);
      
      // Auto-unlock after lockout period
      setTimeout(() => {
        setLockoutUntil(null);
        setFailedAttempts(0);
      }, LOCKOUT_DURATION);
    }
  };

  const resetFailedAttempts = () => {
    setFailedAttempts(0);
    setLockoutUntil(null);
  };

  return {
    isAccountLocked,
    failedAttempts,
    lockoutTimeRemaining,
    checkRateLimit,
    recordFailedAttempt,
    resetFailedAttempts,
    requireMagicLinkForSensitive,
    setRequireMagicLinkForSensitive,
  };
};