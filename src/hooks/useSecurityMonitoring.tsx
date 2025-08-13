import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface SecurityAnomaly {
  type: 'unusual_access_pattern' | 'off_hours_activity' | 'excessive_data_access' | 'suspicious_login';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  metadata: Record<string, any>;
  timestamp: string;
}

interface MonitoringConfig {
  enableRealTimeAlerts: boolean;
  maxAccessPerHour: number;
  maxPatientAccessPerDay: number;
  businessHoursStart: number;
  businessHoursEnd: number;
  alertThresholds: {
    low: number;
    medium: number;
    high: number;
  };
}

export const useSecurityMonitoring = () => {
  const { profile } = useAuth();
  const [anomalies, setAnomalies] = useState<SecurityAnomaly[]>([]);
  const [config, setConfig] = useState<MonitoringConfig>({
    enableRealTimeAlerts: true,
    maxAccessPerHour: 50,
    maxPatientAccessPerDay: 100,
    businessHoursStart: 7,
    businessHoursEnd: 19,
    alertThresholds: {
      low: 10,
      medium: 25,
      high: 50
    }
  });

  // Detect unusual access patterns
  const detectAnomalies = useCallback(async () => {
    if (!profile?.clinic_id) return;

    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Get recent security audit logs
      const { data: recentLogs } = await supabase
        .from('security_audit_log')
        .select('*')
        .eq('clinic_id', profile.clinic_id)
        .gte('created_at', oneHourAgo.toISOString())
        .order('created_at', { ascending: false });

      if (!recentLogs) return;

      const detectedAnomalies: SecurityAnomaly[] = [];

      // Check for excessive access in the last hour
      const accessCount = recentLogs.length;
      if (accessCount > config.maxAccessPerHour) {
        detectedAnomalies.push({
          type: 'excessive_data_access',
          severity: accessCount > config.alertThresholds.high ? 'critical' : 'high',
          description: `${accessCount} security events in the last hour (threshold: ${config.maxAccessPerHour})`,
          metadata: {
            access_count: accessCount,
            threshold: config.maxAccessPerHour,
            timeframe: '1_hour'
          },
          timestamp: now.toISOString()
        });
      }

      // Check for off-hours activity
      const currentHour = now.getHours();
      const isOffHours = currentHour < config.businessHoursStart || currentHour > config.businessHoursEnd;
      
      if (isOffHours) {
        const offHoursActivity = recentLogs.filter(log => 
          log.resource_type === 'patient' || log.action_type.includes('sensitive')
        );
        
        if (offHoursActivity.length > 0) {
          detectedAnomalies.push({
            type: 'off_hours_activity',
            severity: 'medium',
            description: `${offHoursActivity.length} sensitive data access events during off-hours`,
            metadata: {
              activity_count: offHoursActivity.length,
              current_hour: currentHour,
              business_hours: `${config.businessHoursStart}-${config.businessHoursEnd}`
            },
            timestamp: now.toISOString()
          });
        }
      }

      // Check for unusual user access patterns
      const userAccessMap = new Map<string, number>();
      recentLogs.forEach(log => {
        if (log.user_id) {
          userAccessMap.set(log.user_id, (userAccessMap.get(log.user_id) || 0) + 1);
        }
      });

      userAccessMap.forEach((count, userId) => {
        if (count > config.alertThresholds.medium) {
          detectedAnomalies.push({
            type: 'unusual_access_pattern',
            severity: count > config.alertThresholds.high ? 'high' : 'medium',
            description: `User ${userId} has ${count} access events in the last hour`,
            metadata: {
              user_id: userId,
              access_count: count,
              threshold: config.alertThresholds.medium
            },
            timestamp: now.toISOString()
          });
        }
      });

      // Check for excessive patient data access
      const { data: patientAccess } = await supabase
        .from('security_audit_log')
        .select('*')
        .eq('clinic_id', profile.clinic_id)
        .eq('resource_type', 'patient')
        .gte('created_at', oneDayAgo.toISOString());

      if (patientAccess && patientAccess.length > config.maxPatientAccessPerDay) {
        detectedAnomalies.push({
          type: 'excessive_data_access',
          severity: 'high',
          description: `${patientAccess.length} patient data access events in 24 hours (threshold: ${config.maxPatientAccessPerDay})`,
          metadata: {
            patient_access_count: patientAccess.length,
            threshold: config.maxPatientAccessPerDay,
            timeframe: '24_hours'
          },
          timestamp: now.toISOString()
        });
      }

      setAnomalies(detectedAnomalies);

      // Create security alerts for critical anomalies
      for (const anomaly of detectedAnomalies) {
        if (anomaly.severity === 'critical' || anomaly.severity === 'high') {
          await supabase.rpc('create_security_alert', {
            p_clinic_id: profile.clinic_id,
            p_alert_type: anomaly.type,
            p_severity: anomaly.severity,
            p_description: anomaly.description,
            p_metadata: anomaly.metadata
          });
        }
      }

    } catch (error) {
      console.error('Anomaly detection failed:', error);
    }
  }, [profile, config]);

  // Set up real-time monitoring
  useEffect(() => {
    if (!profile?.clinic_id || !config.enableRealTimeAlerts) return;

    // Run initial detection
    detectAnomalies();

    // Set up periodic monitoring (every 5 minutes)
    const interval = setInterval(detectAnomalies, 5 * 60 * 1000);

    // Set up real-time subscription for new security events
    const subscription = supabase
      .channel(`security_monitoring_${profile.clinic_id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'security_audit_log',
        filter: `clinic_id=eq.${profile.clinic_id}`
      }, () => {
        // Trigger anomaly detection on new security events
        setTimeout(detectAnomalies, 1000);
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      subscription.unsubscribe();
    };
  }, [profile?.clinic_id, config.enableRealTimeAlerts, detectAnomalies]);

  // Generate compliance report
  const generateComplianceReport = useCallback(async (startDate: Date, endDate: Date) => {
    if (!profile?.clinic_id) return null;

    try {
      const { data: auditLogs } = await supabase
        .from('security_audit_log')
        .select('*')
        .eq('clinic_id', profile.clinic_id)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      const { data: securityAlerts } = await supabase
        .from('security_alerts')
        .select('*')
        .eq('clinic_id', profile.clinic_id)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (!auditLogs) return null;

      // Generate compliance metrics
      const totalEvents = auditLogs.length;
      const userAccess = auditLogs.filter(log => log.resource_type === 'patient').length;
      const adminActions = auditLogs.filter(log => log.action_type.includes('admin')).length;
      const failedAccess = auditLogs.filter(log => log.action_type.includes('denied')).length;
      const offHoursAccess = auditLogs.filter(log => {
        const hour = new Date(log.created_at).getHours();
        return hour < config.businessHoursStart || hour > config.businessHoursEnd;
      }).length;

      const report = {
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        },
        metrics: {
          total_security_events: totalEvents,
          patient_data_access: userAccess,
          admin_actions: adminActions,
          failed_access_attempts: failedAccess,
          off_hours_access: offHoursAccess,
          security_alerts: securityAlerts?.length || 0
        },
        compliance_score: Math.max(0, 100 - (failedAccess * 2) - (offHoursAccess * 1.5) - ((securityAlerts?.length || 0) * 5)),
        recommendations: [] as string[]
      };

      // Generate recommendations
      if (failedAccess > 10) {
        report.recommendations.push('Review user permissions and access controls');
      }
      if (offHoursAccess > 5) {
        report.recommendations.push('Implement stricter off-hours access restrictions');
      }
      if ((securityAlerts?.length || 0) > 0) {
        report.recommendations.push('Address outstanding security alerts');
      }
      if (report.compliance_score < 85) {
        report.recommendations.push('Enhance security monitoring and staff training');
      }

      return report;
    } catch (error) {
      console.error('Failed to generate compliance report:', error);
      return null;
    }
  }, [profile, config]);

  // Update monitoring configuration
  const updateConfig = useCallback((newConfig: Partial<MonitoringConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  // Log security events
  const logSecurityEvent = useCallback(async (
    eventType: string,
    eventCategory: string = 'access',
    resourceType?: string,
    resourceId?: string,
    riskLevel: string = 'normal',
    metadata: any = {}
  ) => {
    try {
      const { error } = await supabase.rpc('log_security_event', {
        p_event_type: eventType,
        p_event_category: eventCategory,
        p_resource_type: resourceType,
        p_resource_id: resourceId,
        p_risk_level: riskLevel,
        p_metadata: metadata
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error logging security event:', error);
    }
  }, []);

  return {
    anomalies,
    config,
    updateConfig,
    detectAnomalies,
    generateComplianceReport,
    logSecurityEvent
  };
};