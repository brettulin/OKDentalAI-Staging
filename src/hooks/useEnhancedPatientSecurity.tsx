import { useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSecurityAudit } from '@/hooks/useSecurityAudit';
import { supabase } from '@/integrations/supabase/client';

interface PatientAccessLog {
  patientId: string;
  accessType: 'view' | 'edit' | 'create' | 'delete';
  metadata?: Record<string, any>;
}

export const useEnhancedPatientSecurity = () => {
  const { profile } = useAuth();
  const { logAccess } = useSecurityAudit();

  // Enhanced patient access validation with database-level security
  const validatePatientAccess = useCallback(async (patientId: string, operation: string): Promise<boolean> => {
    if (!profile?.clinic_id) return false;

    try {
      // Use enhanced database validation with automatic logging
      const { data, error } = await supabase.rpc('validate_patient_access_with_logging', {
        p_patient_id: patientId,
        p_operation: operation
      });

      if (error) {
        console.error('Patient access validation error:', error);
        return false;
      }

      return data;
    } catch (error) {
      console.error('Patient access validation failed:', error);
      return false;
    }
  }, [profile, logAccess]);

  // Monitor unusual access patterns
  const checkAccessPattern = useCallback(async (patientId: string) => {
    if (!profile?.clinic_id) return;

    try {
      // Check for excessive access in short time window
      const { data: recentAccess } = await supabase
        .from('security_audit_log')
        .select('created_at')
        .eq('user_id', profile.user_id)
        .eq('resource_type', 'patient')
        .eq('resource_id', patientId)
        .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour
        .order('created_at', { ascending: false });

      if (recentAccess && recentAccess.length > 10) {
        // Trigger security alert for excessive access
        await supabase.rpc('create_security_alert', {
          p_clinic_id: profile.clinic_id,
          p_alert_type: 'excessive_patient_access',
          p_severity: 'medium',
          p_description: `User ${profile.user_id} accessed patient ${patientId} ${recentAccess.length} times in the last hour`,
          p_metadata: {
            user_id: profile.user_id,
            patient_id: patientId,
            access_count: recentAccess.length,
            timeframe: '1_hour'
          }
        });
      }
    } catch (error) {
      console.error('Access pattern check failed:', error);
    }
  }, [profile]);

  // Secure patient data access with comprehensive logging
  const logPatientAccess = useCallback(async (accessLog: PatientAccessLog) => {
    await validatePatientAccess(accessLog.patientId, accessLog.accessType);
    await checkAccessPattern(accessLog.patientId);

    // Additional logging for high-risk operations
    if (accessLog.accessType === 'delete') {
      await logAccess({
        action_type: 'patient_delete_attempt',
        resource_type: 'patient',
        resource_id: accessLog.patientId,
        metadata: {
          ...accessLog.metadata,
          risk_level: 'critical',
          requires_approval: true
        }
      });
    }
  }, [validatePatientAccess, checkAccessPattern, logAccess]);

  return {
    validatePatientAccess,
    logPatientAccess,
    checkAccessPattern
  };
};