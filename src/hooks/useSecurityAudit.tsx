import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface SecurityAuditLog {
  action_type: string;
  resource_type: string;
  resource_id?: string;
  metadata?: any;
}

export const useSecurityAudit = () => {
  const { profile } = useAuth();

  const logAccess = async ({
    action_type,
    resource_type,
    resource_id,
    metadata = {}
  }: SecurityAuditLog) => {
    if (!profile?.clinic_id) return;

    try {
      await supabase.rpc('log_sensitive_access', {
        p_clinic_id: profile.clinic_id,
        p_action_type: action_type,
        p_resource_type: resource_type,
        p_resource_id: resource_id,
        p_metadata: metadata
      });
    } catch (error) {
      console.error('Failed to log security audit:', error);
    }
  };

  return { logAccess };
};