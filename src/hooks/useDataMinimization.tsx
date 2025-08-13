import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface DataRetentionPolicy {
  dataType: string;
  retentionPeriod: number; // in days
  autoCleanup: boolean;
  encryptionRequired: boolean;
  accessControl: 'owner_only' | 'admin_only' | 'medical_staff' | 'assigned_staff';
}

interface DataMinimizationSettings {
  enableAutoCleanup: boolean;
  defaultRetentionPeriod: number;
  requireJustificationForExport: boolean;
  limitBulkAccess: boolean;
  archiveOldRecords: boolean;
  anonymizeAfterRetention: boolean;
}

const DEFAULT_RETENTION_POLICIES: DataRetentionPolicy[] = [
  {
    dataType: 'patient_medical_records',
    retentionPeriod: 7 * 365, // 7 years (HIPAA requirement)
    autoCleanup: false,
    encryptionRequired: true,
    accessControl: 'medical_staff'
  },
  {
    dataType: 'call_transcripts',
    retentionPeriod: 7 * 365, // 7 years
    autoCleanup: true,
    encryptionRequired: true,
    accessControl: 'assigned_staff'
  },
  {
    dataType: 'security_audit_logs',
    retentionPeriod: 2 * 365, // 2 years
    autoCleanup: true,
    encryptionRequired: false,
    accessControl: 'admin_only'
  },
  {
    dataType: 'user_activity_logs',
    retentionPeriod: 1 * 365, // 1 year
    autoCleanup: true,
    encryptionRequired: false,
    accessControl: 'owner_only'
  },
  {
    dataType: 'pms_credentials',
    retentionPeriod: 365, // 1 year
    autoCleanup: false,
    encryptionRequired: true,
    accessControl: 'owner_only'
  }
];

export const useDataMinimization = () => {
  const { profile } = useAuth();
  const [retentionPolicies, setRetentionPolicies] = useState<DataRetentionPolicy[]>(DEFAULT_RETENTION_POLICIES);
  const [settings, setSettings] = useState<DataMinimizationSettings>({
    enableAutoCleanup: true,
    defaultRetentionPeriod: 7 * 365, // 7 years
    requireJustificationForExport: true,
    limitBulkAccess: true,
    archiveOldRecords: true,
    anonymizeAfterRetention: false
  });
  const [cleanupStats, setCleanupStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Check if user has data management permissions
  const hasDataManagementPermissions = useCallback((): boolean => {
    return profile?.role === 'owner' || profile?.admin_role === 'technical_admin';
  }, [profile]);

  // Execute data cleanup
  const executeDataCleanup = useCallback(async (dryRun: boolean = false): Promise<any> => {
    if (!hasDataManagementPermissions()) {
      throw new Error('Insufficient permissions for data cleanup');
    }

    setLoading(true);
    try {
      if (!dryRun) {
        // Execute actual cleanup
        const { error } = await supabase.rpc('cleanup_old_sensitive_data');
        
        if (error) {
          console.error('Data cleanup failed:', error);
          throw new Error(`Data cleanup failed: ${error.message}`);
        }
      }

      // Get cleanup statistics
      const stats = await getCleanupStatistics();
      setCleanupStats(stats);

      // Log cleanup activity
      await supabase.rpc('log_sensitive_access', {
        p_clinic_id: profile?.clinic_id,
        p_action_type: dryRun ? 'data_cleanup_simulation' : 'data_cleanup_executed',
        p_resource_type: 'data_retention',
        p_resource_id: null,
        p_metadata: {
          executed_by: profile?.user_id,
          dry_run: dryRun,
          cleanup_stats: stats,
          risk_level: 'normal'
        }
      });

      return stats;
    } catch (error) {
      console.error('Data cleanup error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [profile, hasDataManagementPermissions]);

  // Get cleanup statistics
  const getCleanupStatistics = useCallback(async () => {
    if (!profile?.clinic_id) return null;

    try {
      // Calculate data that would be affected by cleanup
      const [callsResult, logsResult, auditResult] = await Promise.all([
        // Old call transcripts
        supabase
          .from('calls')
          .select('id, started_at')
          .eq('clinic_id', profile.clinic_id)
          .lt('started_at', new Date(Date.now() - 7 * 365 * 24 * 60 * 60 * 1000).toISOString()),
        
        // Old security logs
        supabase
          .from('security_audit_log')
          .select('id, created_at')
          .eq('clinic_id', profile.clinic_id)
          .lt('created_at', new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString()),
        
        // Old audit logs
        supabase
          .from('audit_log')
          .select('id, at')
          .eq('clinic_id', profile.clinic_id)
          .lt('at', new Date(Date.now() - 7 * 365 * 24 * 60 * 60 * 1000).toISOString())
      ]);

      return {
        old_call_transcripts: callsResult.data?.length || 0,
        old_security_logs: logsResult.data?.length || 0,
        old_audit_logs: auditResult.data?.length || 0,
        total_records_affected: (callsResult.data?.length || 0) + 
                               (logsResult.data?.length || 0) + 
                               (auditResult.data?.length || 0),
        last_calculated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to calculate cleanup statistics:', error);
      return null;
    }
  }, [profile]);

  // Update retention policy
  const updateRetentionPolicy = useCallback(async (
    dataType: string, 
    policy: Partial<DataRetentionPolicy>
  ): Promise<boolean> => {
    if (!hasDataManagementPermissions()) {
      throw new Error('Insufficient permissions to update retention policies');
    }

    try {
      setRetentionPolicies(prev => 
        prev.map(p => p.dataType === dataType ? { ...p, ...policy } : p)
      );

      // Log policy change
      await supabase.rpc('log_sensitive_access', {
        p_clinic_id: profile?.clinic_id,
        p_action_type: 'retention_policy_updated',
        p_resource_type: 'data_retention_policy',
        p_resource_id: dataType,
        p_metadata: {
          updated_by: profile?.user_id,
          policy_changes: policy,
          data_type: dataType,
          risk_level: 'high'
        }
      });

      return true;
    } catch (error) {
      console.error('Failed to update retention policy:', error);
      return false;
    }
  }, [profile, hasDataManagementPermissions]);

  // Validate data export request
  const validateDataExport = useCallback(async (
    resourceType: string,
    resourceIds: string[],
    justification?: string
  ): Promise<boolean> => {
    if (!profile?.clinic_id) return false;

    try {
      // Check if justification is required
      if (settings.requireJustificationForExport && !justification) {
        throw new Error('Justification required for data export');
      }

      // Check bulk access limits
      if (settings.limitBulkAccess && resourceIds.length > 10) {
        throw new Error('Bulk access limited to 10 records at a time');
      }

      // Log export validation
      await supabase.rpc('log_sensitive_access', {
        p_clinic_id: profile.clinic_id,
        p_action_type: 'data_export_validated',
        p_resource_type: resourceType,
        p_resource_id: resourceIds.join(','),
        p_metadata: {
          resource_count: resourceIds.length,
          justification: justification || 'none_provided',
          export_timestamp: new Date().toISOString(),
          risk_level: resourceIds.length > 5 ? 'high' : 'normal'
        }
      });

      return true;
    } catch (error) {
      console.error('Data export validation failed:', error);
      throw error;
    }
  }, [profile, settings]);

  // Anonymize expired data
  const anonymizeExpiredData = useCallback(async (dataType: string): Promise<boolean> => {
    if (!hasDataManagementPermissions()) {
      throw new Error('Insufficient permissions for data anonymization');
    }

    try {
      const policy = retentionPolicies.find(p => p.dataType === dataType);
      if (!policy) {
        throw new Error(`No retention policy found for ${dataType}`);
      }

      // This would need specific implementation for each data type
      // For now, we'll log the anonymization request
      await supabase.rpc('log_sensitive_access', {
        p_clinic_id: profile?.clinic_id,
        p_action_type: 'data_anonymization_requested',
        p_resource_type: dataType,
        p_resource_id: null,
        p_metadata: {
          requested_by: profile?.user_id,
          retention_period: policy.retentionPeriod,
          anonymization_timestamp: new Date().toISOString(),
          risk_level: 'high'
        }
      });

      return true;
    } catch (error) {
      console.error('Data anonymization failed:', error);
      return false;
    }
  }, [profile, retentionPolicies, hasDataManagementPermissions]);

  // Schedule automatic cleanup
  const scheduleAutoCleanup = useCallback(async (enabled: boolean): Promise<boolean> => {
    if (!hasDataManagementPermissions()) {
      throw new Error('Insufficient permissions to schedule automatic cleanup');
    }

    try {
      setSettings(prev => ({ ...prev, enableAutoCleanup: enabled }));

      // Log scheduling change
      await supabase.rpc('log_sensitive_access', {
        p_clinic_id: profile?.clinic_id,
        p_action_type: 'auto_cleanup_scheduled',
        p_resource_type: 'data_retention_schedule',
        p_resource_id: null,
        p_metadata: {
          scheduled_by: profile?.user_id,
          auto_cleanup_enabled: enabled,
          schedule_timestamp: new Date().toISOString(),
          risk_level: 'normal'
        }
      });

      return true;
    } catch (error) {
      console.error('Auto cleanup scheduling failed:', error);
      return false;
    }
  }, [profile, hasDataManagementPermissions]);

  // Load initial data
  useEffect(() => {
    if (profile?.clinic_id && hasDataManagementPermissions()) {
      getCleanupStatistics().then(setCleanupStats);
    }
  }, [profile, hasDataManagementPermissions, getCleanupStatistics]);

  return {
    retentionPolicies,
    settings,
    cleanupStats,
    loading,
    hasDataManagementPermissions,
    executeDataCleanup,
    getCleanupStatistics,
    updateRetentionPolicy,
    validateDataExport,
    anonymizeExpiredData,
    scheduleAutoCleanup
  };
};