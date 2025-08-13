import { useCallback, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSecurityAudit } from '@/hooks/useSecurityAudit';
import { supabase } from '@/integrations/supabase/client';

interface CredentialAccess {
  officeId: string;
  purpose: string;
  metadata?: Record<string, any>;
}

export const useCredentialSecurity = () => {
  const { profile } = useAuth();
  const { logAccess } = useSecurityAudit();
  const [credentialAccess, setCredentialAccess] = useState<Map<string, number>>(new Map());

  // Time-limited credential access (15 minutes)
  const CREDENTIAL_ACCESS_TIMEOUT = 15 * 60 * 1000;

  // Request credential access with comprehensive logging
  const requestCredentialAccess = useCallback(async (accessRequest: CredentialAccess): Promise<boolean> => {
    if (!profile?.clinic_id) return false;

    try {
      // Use enhanced database validation
      const { data: hasPermission, error } = await supabase.rpc('validate_pms_credential_access', {
        p_office_id: accessRequest.officeId,
        p_purpose: accessRequest.purpose
      });

      if (error || !hasPermission) {
        console.error('PMS credential access denied:', error?.message);
        return false;
      }

      // Log credential access attempt
      await logAccess({
        action_type: 'credential_access_granted',
        resource_type: 'pms_credentials',
        resource_id: accessRequest.officeId,
        metadata: {
          purpose: accessRequest.purpose,
          user_role: profile.role,
          admin_role: profile.admin_role,
          access_timestamp: new Date().toISOString(),
          ...accessRequest.metadata
        }
      });

      // Set time-limited access
      setCredentialAccess(prev => {
        const newMap = new Map(prev);
        newMap.set(accessRequest.officeId, Date.now() + CREDENTIAL_ACCESS_TIMEOUT);
        return newMap;
      });

      // Clear access after timeout
      setTimeout(() => {
        setCredentialAccess(prev => {
          const newMap = new Map(prev);
          newMap.delete(accessRequest.officeId);
          return newMap;
        });
      }, CREDENTIAL_ACCESS_TIMEOUT);

      return true;
    } catch (error) {
      console.error('Credential access request failed:', error);
      return false;
    }
  }, [profile, logAccess]);

  // Validate ongoing credential access
  const validateCredentialAccess = useCallback((officeId: string): boolean => {
    const accessTime = credentialAccess.get(officeId);
    return accessTime ? Date.now() < accessTime : false;
  }, [credentialAccess]);

  // Monitor credential access patterns
  const monitorCredentialAccess = useCallback(async (officeId: string) => {
    if (!profile?.clinic_id) return;

    try {
      // Check for excessive credential access
      const { data: recentAccess } = await supabase
        .from('security_audit_log')
        .select('created_at')
        .eq('user_id', profile.user_id)
        .eq('resource_type', 'pms_credentials')
        .eq('action_type', 'credential_access_granted')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
        .order('created_at', { ascending: false });

      if (recentAccess && recentAccess.length > 5) {
        // Create security alert for excessive credential access
        await supabase.rpc('create_security_alert', {
          p_clinic_id: profile.clinic_id,
          p_alert_type: 'excessive_credential_access',
          p_severity: 'high',
          p_description: `User ${profile.user_id} accessed PMS credentials ${recentAccess.length} times in 24 hours`,
          p_metadata: {
            user_id: profile.user_id,
            office_id: officeId,
            access_count: recentAccess.length,
            timeframe: '24_hours'
          }
        });
      }
    } catch (error) {
      console.error('Credential access monitoring failed:', error);
    }
  }, [profile]);

  // Revoke credential access
  const revokeCredentialAccess = useCallback((officeId: string) => {
    setCredentialAccess(prev => {
      const newMap = new Map(prev);
      newMap.delete(officeId);
      return newMap;
    });

    // Log revocation
    logAccess({
      action_type: 'credential_access_revoked',
      resource_type: 'pms_credentials',
      resource_id: officeId,
      metadata: {
        revoked_by: 'user_action',
        timestamp: new Date().toISOString()
      }
    });
  }, [logAccess]);

  return {
    requestCredentialAccess,
    validateCredentialAccess,
    monitorCredentialAccess,
    revokeCredentialAccess,
    hasActiveAccess: (officeId: string) => validateCredentialAccess(officeId)
  };
};