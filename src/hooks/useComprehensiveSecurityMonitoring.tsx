import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface SecurityAlert {
  id: string;
  alert_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  created_at: string;
  resolved: boolean;
  metadata?: any;
}

interface SecurityMetrics {
  activeAlerts: number;
  criticalAlerts: number;
  recentAccessAttempts: number;
  failedAccessAttempts: number;
  riskScore: number;
}

export const useComprehensiveSecurityMonitoring = () => {
  const { profile } = useAuth();
  const [securityAlerts, setSecurityAlerts] = useState<SecurityAlert[]>([]);
  const [securityMetrics, setSecurityMetrics] = useState<SecurityMetrics>({
    activeAlerts: 0,
    criticalAlerts: 0,
    recentAccessAttempts: 0,
    failedAccessAttempts: 0,
    riskScore: 0
  });
  const [loading, setLoading] = useState(false);

  // Validate comprehensive access using new database function
  const validateComprehensiveAccess = useCallback(async (
    resourceType: string,
    resourceId: string,
    operation: string
  ): Promise<boolean> => {
    if (!profile?.clinic_id) return false;

    try {
      const { data, error } = await supabase.rpc('validate_comprehensive_access', {
        p_resource_type: resourceType,
        p_resource_id: resourceId,
        p_operation: operation
      });

      if (error) {
        console.error('Comprehensive access validation error:', error);
        return false;
      }

      return data;
    } catch (error) {
      console.error('Comprehensive access validation failed:', error);
      return false;
    }
  }, [profile]);

  // Fetch current security alerts
  const fetchSecurityAlerts = useCallback(async () => {
    if (!profile?.clinic_id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('security_alerts')
        .select('*')
        .eq('clinic_id', profile.clinic_id)
        .eq('resolved', false)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Failed to fetch security alerts:', error);
        return;
      }

      setSecurityAlerts((data || []).map(alert => ({
        ...alert,
        severity: alert.severity as 'low' | 'medium' | 'high' | 'critical'
      })));
    } catch (error) {
      console.error('Security alerts fetch failed:', error);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  // Calculate security metrics
  const calculateSecurityMetrics = useCallback(async () => {
    if (!profile?.clinic_id) return;

    try {
      // Get active alerts count
      const { data: alerts } = await supabase
        .from('security_alerts')
        .select('severity')
        .eq('clinic_id', profile.clinic_id)
        .eq('resolved', false);

      const activeAlerts = alerts?.length || 0;
      const criticalAlerts = alerts?.filter(a => a.severity === 'critical').length || 0;

      // Get recent access attempts (last 24 hours)
      const { data: recentAccess } = await supabase
        .from('security_audit_log')
        .select('action_type')
        .eq('clinic_id', profile.clinic_id)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      const recentAccessAttempts = recentAccess?.length || 0;
      const failedAccessAttempts = recentAccess?.filter(a => 
        a.action_type.includes('denied') || a.action_type.includes('failed')
      ).length || 0;

      // Calculate risk score (0-100)
      let riskScore = 0;
      riskScore += criticalAlerts * 25; // Critical alerts add 25 points each
      riskScore += activeAlerts * 5; // Other alerts add 5 points each
      riskScore += Math.min(failedAccessAttempts * 2, 20); // Failed attempts (max 20 points)
      riskScore = Math.min(riskScore, 100); // Cap at 100

      setSecurityMetrics({
        activeAlerts,
        criticalAlerts,
        recentAccessAttempts,
        failedAccessAttempts,
        riskScore
      });
    } catch (error) {
      console.error('Failed to calculate security metrics:', error);
    }
  }, [profile]);

  // Resolve security alert
  const resolveSecurityAlert = useCallback(async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('security_alerts')
        .update({ 
          resolved: true, 
          resolved_at: new Date().toISOString(),
          resolved_by: profile?.user_id 
        })
        .eq('id', alertId);

      if (error) {
        console.error('Failed to resolve security alert:', error);
        return false;
      }

      // Refresh alerts
      await fetchSecurityAlerts();
      await calculateSecurityMetrics();
      return true;
    } catch (error) {
      console.error('Security alert resolution failed:', error);
      return false;
    }
  }, [profile, fetchSecurityAlerts, calculateSecurityMetrics]);

  // Create security incident
  const createSecurityIncident = useCallback(async (
    alertType: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    description: string,
    metadata?: any
  ) => {
    if (!profile?.clinic_id) return false;

    try {
      const { error } = await supabase.rpc('create_security_alert', {
        p_clinic_id: profile.clinic_id,
        p_alert_type: alertType,
        p_severity: severity,
        p_description: description,
        p_metadata: metadata || {}
      });

      if (error) {
        console.error('Failed to create security incident:', error);
        return false;
      }

      // Refresh data
      await fetchSecurityAlerts();
      await calculateSecurityMetrics();
      return true;
    } catch (error) {
      console.error('Security incident creation failed:', error);
      return false;
    }
  }, [profile, fetchSecurityAlerts, calculateSecurityMetrics]);

  // Monitor user session security
  const monitorSessionSecurity = useCallback(async () => {
    if (!profile?.user_id) return;

    try {
      // Check for unusual login patterns
      const { data: recentLogins } = await supabase
        .from('security_audit_log')
        .select('created_at, metadata')
        .eq('user_id', profile.user_id)
        .eq('action_type', 'user_signed_in')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (recentLogins && recentLogins.length > 10) {
        await createSecurityIncident(
          'unusual_login_pattern',
          'medium',
          `User ${profile.user_id} logged in ${recentLogins.length} times in 24 hours`,
          {
            user_id: profile.user_id,
            login_count: recentLogins.length,
            timeframe: '24_hours'
          }
        );
      }
    } catch (error) {
      console.error('Session security monitoring failed:', error);
    }
  }, [profile, createSecurityIncident]);

  // Auto-refresh security data
  useEffect(() => {
    if (profile?.clinic_id) {
      fetchSecurityAlerts();
      calculateSecurityMetrics();
      monitorSessionSecurity();

      // Set up periodic refresh
      const interval = setInterval(() => {
        fetchSecurityAlerts();
        calculateSecurityMetrics();
      }, 5 * 60 * 1000); // Every 5 minutes

      return () => clearInterval(interval);
    }
  }, [profile, fetchSecurityAlerts, calculateSecurityMetrics, monitorSessionSecurity]);

  return {
    securityAlerts,
    securityMetrics,
    loading,
    validateComprehensiveAccess,
    fetchSecurityAlerts,
    calculateSecurityMetrics,
    resolveSecurityAlert,
    createSecurityIncident,
    monitorSessionSecurity
  };
};