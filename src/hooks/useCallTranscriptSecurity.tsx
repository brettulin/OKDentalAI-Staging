import { useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSecurityAudit } from '@/hooks/useSecurityAudit';
import { supabase } from '@/integrations/supabase/client';

interface CallTranscriptAccess {
  callId: string;
  operation: 'view' | 'export' | 'edit';
  metadata?: Record<string, any>;
}

export const useCallTranscriptSecurity = () => {
  const { profile } = useAuth();
  const { logAccess } = useSecurityAudit();

  // Validate call transcript access based on patient relationships
  const validateCallAccess = useCallback(async (callId: string, operation: string): Promise<boolean> => {
    if (!profile?.clinic_id) return false;

    try {
      // Get call details to check patient relationship
      const { data: call, error: callError } = await supabase
        .from('calls')
        .select(`
          *,
          clinic_id,
          caller_phone
        `)
        .eq('id', callId)
        .eq('clinic_id', profile.clinic_id)
        .single();

      if (callError || !call) {
        await logAccess({
          action_type: 'call_access_denied',
          resource_type: 'call_transcript',
          resource_id: callId,
          metadata: {
            reason: 'call_not_found',
            operation,
            error: callError?.message
          }
        });
        return false;
      }

      // Check if user has permission based on role
      const hasGeneralAccess = profile.role === 'owner' || profile.role === 'doctor';
      
      if (hasGeneralAccess) {
        await logAccess({
          action_type: 'call_access_granted',
          resource_type: 'call_transcript',
          resource_id: callId,
          metadata: {
            access_type: 'general_permission',
            operation,
            user_role: profile.role
          }
        });
        return true;
      }

      // For other roles, check if they're assigned to this call or related patient
      const isAssignedToCall = call.assigned_to === profile.user_id;

      // Check if user has access to patients linked to this phone number
      if (call.caller_phone) {
        const { data: hasPatientAccess } = await supabase
          .from('patients')
          .select('id')
          .eq('clinic_id', profile.clinic_id)
          .eq('phone', call.caller_phone)
          .limit(1);

        if (hasPatientAccess && hasPatientAccess.length > 0) {
          const patientId = hasPatientAccess[0].id;
          const { data: canAccessPatient } = await supabase.rpc('user_can_access_patient', {
            patient_id: patientId
          });

          if (canAccessPatient || isAssignedToCall) {
            await logAccess({
              action_type: 'call_access_granted',
              resource_type: 'call_transcript',
              resource_id: callId,
              metadata: {
                access_type: 'patient_relationship',
                operation,
                patient_id: patientId,
                assigned_to_call: isAssignedToCall
              }
            });
            return true;
          }
        }
      }

      // Access denied
      await logAccess({
        action_type: 'call_access_denied',
        resource_type: 'call_transcript',
        resource_id: callId,
        metadata: {
          reason: 'insufficient_permissions',
          operation,
          user_role: profile.role,
          assigned_to_call: isAssignedToCall
        }
      });
      return false;

    } catch (error) {
      console.error('Call access validation failed:', error);
      return false;
    }
  }, [profile, logAccess]);

  // Monitor unusual call access patterns
  const monitorCallAccess = useCallback(async (callId: string) => {
    if (!profile?.clinic_id) return;

    try {
      // Check for excessive call access
      const { data: recentAccess } = await supabase
        .from('security_audit_log')
        .select('created_at')
        .eq('user_id', profile.user_id)
        .eq('resource_type', 'call_transcript')
        .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour
        .order('created_at', { ascending: false });

      if (recentAccess && recentAccess.length > 20) {
        // Create security alert for excessive call access
        await supabase.rpc('create_security_alert', {
          p_clinic_id: profile.clinic_id,
          p_alert_type: 'excessive_call_access',
          p_severity: 'medium',
          p_description: `User ${profile.user_id} accessed ${recentAccess.length} call transcripts in the last hour`,
          p_metadata: {
            user_id: profile.user_id,
            call_id: callId,
            access_count: recentAccess.length,
            timeframe: '1_hour'
          }
        });
      }
    } catch (error) {
      console.error('Call access monitoring failed:', error);
    }
  }, [profile]);

  // Log call transcript access with enhanced metadata
  const logCallAccess = useCallback(async (accessLog: CallTranscriptAccess) => {
    await validateCallAccess(accessLog.callId, accessLog.operation);
    await monitorCallAccess(accessLog.callId);

    // Additional logging for high-risk operations
    if (accessLog.operation === 'export') {
      await logAccess({
        action_type: 'call_transcript_export',
        resource_type: 'call_transcript',
        resource_id: accessLog.callId,
        metadata: {
          ...accessLog.metadata,
          risk_level: 'elevated',
          requires_justification: true,
          export_timestamp: new Date().toISOString()
        }
      });
    }
  }, [validateCallAccess, monitorCallAccess, logAccess]);

  return {
    validateCallAccess,
    logCallAccess,
    monitorCallAccess
  };
};