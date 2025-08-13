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

  // Enhanced call transcript access validation with database-level security
  const validateCallAccess = useCallback(async (callId: string, operation: string): Promise<boolean> => {
    if (!profile?.clinic_id) return false;

    try {
      // Use enhanced database validation with automatic logging and risk assessment
      const { data, error } = await supabase.rpc('validate_call_transcript_access', {
        p_call_id: callId,
        p_operation: operation
      });

      if (error) {
        console.error('Call access validation error:', error);
        return false;
      }

      return data;

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