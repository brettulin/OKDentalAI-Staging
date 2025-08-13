import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';

interface SecurityMetrics {
  riskScore: number;
  sessionValid: boolean;
  mfaRequired: boolean;
  lastActivity: string;
  securityLevel: 'standard' | 'elevated' | 'critical';
}

interface AccessValidation {
  isValid: boolean;
  reason?: string;
  requiresMfa?: boolean;
}

export const useEnhancedSecurity = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [securityMetrics, setSecurityMetrics] = useState<SecurityMetrics | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  // Create or update enhanced session
  const createEnhancedSession = useCallback(async () => {
    if (!user || !profile?.clinic_id) return;

    try {
      const sessionToken = crypto.randomUUID();
      const deviceFingerprint = await generateDeviceFingerprint();
      
      const { error } = await supabase
        .from('enhanced_user_sessions')
        .upsert({
          user_id: user.id,
          clinic_id: profile.clinic_id,
          session_token: sessionToken,
          device_fingerprint: deviceFingerprint,
          ip_address: await getUserIP(),
          user_agent: navigator.userAgent,
          expires_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), // 8 hours
          security_level: 'standard' as const,
          mfa_verified: false
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;
      
      localStorage.setItem('enhanced_session_token', sessionToken);
      await refreshSecurityMetrics();
      
    } catch (error) {
      console.error('Error creating enhanced session:', error);
    }
  }, [user, profile]);

  // Generate device fingerprint
  const generateDeviceFingerprint = async (): Promise<string> => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx?.fillText('Security fingerprint', 10, 10);
    
    const fingerprint = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screen: `${screen.width}x${screen.height}`,
      canvas: canvas.toDataURL(),
      timestamp: Date.now()
    };
    
    return btoa(JSON.stringify(fingerprint));
  };

  // Get user IP address
  const getUserIP = async (): Promise<string> => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return '0.0.0.0';
    }
  };

  // Refresh security metrics
  const refreshSecurityMetrics = useCallback(async () => {
    if (!user || !profile?.clinic_id) return;

    try {
      // Get current session info
      const { data: sessionData } = await supabase
        .from('enhanced_user_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      // Get recent security events
      const { data: auditData } = await supabase
        .from('enhanced_security_audit_log')
        .select('risk_level')
        .eq('user_id', user.id)
        .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());

      // Calculate risk score
      const riskScore = auditData?.reduce((score, event) => {
        switch (event.risk_level) {
          case 'critical': return score + 10;
          case 'high': return score + 5;
          case 'elevated': return score + 2;
          default: return score + 1;
        }
      }, 0) || 0;

      setSecurityMetrics({
        riskScore,
        sessionValid: sessionData ? new Date(sessionData.expires_at) > new Date() : false,
        mfaRequired: riskScore > 20 || sessionData?.security_level === 'critical',
        lastActivity: sessionData?.last_activity || new Date().toISOString(),
        securityLevel: (sessionData?.security_level as 'standard' | 'elevated' | 'critical') || 'standard'
      });

    } catch (error) {
      console.error('Error refreshing security metrics:', error);
    }
  }, [user, profile]);

  // Validate access to resources
  const validateAccess = useCallback(async (
    resourceType: string,
    resourceId: string,
    operation: string,
    dataClassification: 'public' | 'internal' | 'confidential' | 'restricted' = 'internal'
  ): Promise<AccessValidation> => {
    setIsValidating(true);
    
    try {
      const { data, error } = await supabase.rpc('validate_enhanced_access', {
        p_resource_type: resourceType,
        p_resource_id: resourceId,
        p_operation: operation,
        p_data_classification: dataClassification
      });

      if (error) throw error;

      const result: AccessValidation = {
        isValid: data,
        requiresMfa: securityMetrics?.mfaRequired || dataClassification === 'restricted'
      };

      if (!data) {
        result.reason = securityMetrics?.mfaRequired 
          ? 'Multi-factor authentication required'
          : 'Access denied due to security policy';
        
        toast({
          title: "Access Denied",
          description: result.reason,
          variant: "destructive",
        });
      }

      return result;

    } catch (error) {
      console.error('Error validating access:', error);
      return {
        isValid: false,
        reason: 'Security validation failed'
      };
    } finally {
      setIsValidating(false);
    }
  }, [securityMetrics, toast]);

  // Log security event
  const logSecurityEvent = useCallback(async (
    actionType: string,
    resourceType: string,
    resourceId?: string,
    riskLevel: 'normal' | 'elevated' | 'high' | 'critical' = 'normal',
    metadata: Record<string, any> = {}
  ) => {
    if (!profile?.clinic_id) return;

    try {
      await supabase
        .from('enhanced_security_audit_log')
        .insert({
          clinic_id: profile.clinic_id,
          user_id: user?.id,
          action_type: actionType,
          resource_type: resourceType,
          resource_id: resourceId,
          risk_level: riskLevel,
          ip_address: await getUserIP(),
          user_agent: navigator.userAgent,
          device_fingerprint: await generateDeviceFingerprint(),
          metadata,
          requires_investigation: riskLevel === 'critical'
        });
    } catch (error) {
      console.error('Error logging security event:', error);
    }
  }, [user, profile]);

  // Update session activity
  const updateActivity = useCallback(async () => {
    if (!user) return;

    try {
      await supabase
        .from('enhanced_user_sessions')
        .update({ 
          last_activity: new Date().toISOString(),
          risk_score: securityMetrics?.riskScore || 0
        })
        .eq('user_id', user.id)
        .eq('is_active', true);
    } catch (error) {
      console.error('Error updating session activity:', error);
    }
  }, [user, securityMetrics]);

  // Initialize enhanced session
  useEffect(() => {
    if (user && profile?.clinic_id) {
      createEnhancedSession();
    }
  }, [user, profile, createEnhancedSession]);

  // Refresh metrics periodically
  useEffect(() => {
    if (user) {
      refreshSecurityMetrics();
      const interval = setInterval(refreshSecurityMetrics, 5 * 60 * 1000); // Every 5 minutes
      return () => clearInterval(interval);
    }
  }, [user, refreshSecurityMetrics]);

  // Update activity on user interaction
  useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    const handler = () => updateActivity();

    events.forEach(event => {
      document.addEventListener(event, handler);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handler);
      });
    };
  }, [updateActivity]);

  return {
    securityMetrics,
    isValidating,
    validateAccess,
    logSecurityEvent,
    refreshSecurityMetrics,
    updateActivity
  };
};