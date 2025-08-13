import { useCallback, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface SecurityIncident {
  id: string;
  type: 'data_breach' | 'unauthorized_access' | 'system_compromise' | 'policy_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  status: 'open' | 'investigating' | 'contained' | 'resolved';
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  affected_resources: string[];
  response_actions: any[];
  metadata: any;
}

interface IncidentData {
  type: SecurityIncident['type'];
  severity: SecurityIncident['severity'];
  description: string;
  affectedResources?: string[];
  metadata?: any;
}

export const useIncidentResponse = () => {
  const { profile } = useAuth();
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [loading, setLoading] = useState(false);

  // Check if user has incident management permissions
  const hasIncidentPermissions = useCallback((): boolean => {
    return profile?.role === 'owner' || profile?.admin_role === 'technical_admin';
  }, [profile]);

  // Create new security incident
  const createIncident = useCallback(async (incidentData: IncidentData): Promise<SecurityIncident | null> => {
    if (!hasIncidentPermissions()) {
      throw new Error('Insufficient permissions for incident management');
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('security-incident-manager', {
        body: {
          action: 'create',
          incidentData
        }
      });

      if (error) {
        console.error('Failed to create incident:', error);
        throw new Error(`Incident creation failed: ${error.message}`);
      }

      const newIncident = data.incident;
      setIncidents(prev => [newIncident, ...prev]);

      // Auto-trigger emergency procedures for critical incidents
      if (incidentData.severity === 'critical') {
        await triggerEmergencyResponse(newIncident);
      }

      return newIncident;
    } catch (error) {
      console.error('Incident creation error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [profile, hasIncidentPermissions]);

  // List recent incidents
  const listIncidents = useCallback(async (): Promise<SecurityIncident[]> => {
    if (!hasIncidentPermissions()) {
      throw new Error('Insufficient permissions to view incidents');
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('security-incident-manager', {
        body: {
          action: 'list'
        }
      });

      if (error) {
        console.error('Failed to list incidents:', error);
        throw new Error(`Failed to list incidents: ${error.message}`);
      }

      // Transform security alerts to incidents format
      const incidentsList = data.incidents.map((alert: any) => ({
        id: alert.id,
        type: alert.alert_type.replace('incident_', ''),
        severity: alert.severity,
        description: alert.description,
        status: alert.resolved ? 'resolved' : 'open',
        created_at: alert.created_at,
        updated_at: alert.created_at,
        resolved_at: alert.resolved_at,
        affected_resources: alert.metadata?.affected_resources || [],
        response_actions: alert.metadata?.response_actions || [],
        metadata: alert.metadata || {}
      }));

      setIncidents(incidentsList);
      return incidentsList;
    } catch (error) {
      console.error('Incident listing error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [hasIncidentPermissions]);

  // Update incident status
  const updateIncident = useCallback(async (
    incidentId: string, 
    updateData: Partial<SecurityIncident>
  ): Promise<boolean> => {
    if (!hasIncidentPermissions()) {
      throw new Error('Insufficient permissions to update incidents');
    }

    try {
      const { data, error } = await supabase.functions.invoke('security-incident-manager', {
        body: {
          action: 'update',
          incidentId,
          updateData: {
            ...updateData,
            updated_at: new Date().toISOString(),
            updated_by: profile?.user_id
          }
        }
      });

      if (error) {
        console.error('Failed to update incident:', error);
        throw new Error(`Incident update failed: ${error.message}`);
      }

      // Update local state
      setIncidents(prev => prev.map(incident => 
        incident.id === incidentId 
          ? { ...incident, ...updateData, updated_at: new Date().toISOString() }
          : incident
      ));

      return true;
    } catch (error) {
      console.error('Incident update error:', error);
      throw error;
    }
  }, [profile, hasIncidentPermissions]);

  // Resolve incident
  const resolveIncident = useCallback(async (
    incidentId: string, 
    resolutionNotes?: string
  ): Promise<boolean> => {
    if (!hasIncidentPermissions()) {
      throw new Error('Insufficient permissions to resolve incidents');
    }

    try {
      const { data, error } = await supabase.functions.invoke('security-incident-manager', {
        body: {
          action: 'resolve',
          incidentId,
          updateData: {
            status: 'resolved',
            resolution_notes: resolutionNotes,
            resolved_by: profile?.user_id,
            resolved_at: new Date().toISOString()
          }
        }
      });

      if (error) {
        console.error('Failed to resolve incident:', error);
        throw new Error(`Incident resolution failed: ${error.message}`);
      }

      // Update local state
      setIncidents(prev => prev.map(incident => 
        incident.id === incidentId 
          ? { 
              ...incident, 
              status: 'resolved', 
              resolved_at: new Date().toISOString(),
              metadata: { ...incident.metadata, resolution_notes: resolutionNotes }
            }
          : incident
      ));

      return true;
    } catch (error) {
      console.error('Incident resolution error:', error);
      throw error;
    }
  }, [profile, hasIncidentPermissions]);

  // Trigger emergency response procedures
  const triggerEmergencyResponse = useCallback(async (incident: SecurityIncident) => {
    try {
      // 1. Create emergency security alert
      await supabase.rpc('create_security_alert', {
        p_clinic_id: profile?.clinic_id,
        p_alert_type: 'emergency_response_activated',
        p_severity: 'critical',
        p_description: `Emergency response activated for ${incident.type}: ${incident.description}`,
        p_metadata: {
          trigger_incident_id: incident.id,
          emergency_level: incident.severity,
          auto_activated: true,
          requires_immediate_action: true
        }
      });

      // 2. Log emergency response activation
      await supabase.rpc('log_sensitive_access', {
        p_clinic_id: profile?.clinic_id,
        p_action_type: 'emergency_response_triggered',
        p_resource_type: 'incident_response',
        p_resource_id: incident.id,
        p_metadata: {
          incident_type: incident.type,
          severity: incident.severity,
          triggered_by: 'automated_system',
          response_timestamp: new Date().toISOString(),
          risk_level: 'critical'
        }
      });

      // 3. For data breaches, trigger additional security measures
      if (incident.type === 'data_breach') {
        await supabase.rpc('create_security_alert', {
          p_clinic_id: profile?.clinic_id,
          p_alert_type: 'data_breach_containment',
          p_severity: 'critical',
          p_description: 'Data breach containment procedures activated',
          p_metadata: {
            breach_incident_id: incident.id,
            containment_actions: [
              'access_review_initiated',
              'affected_systems_identified',
              'breach_notification_prepared'
            ],
            requires_legal_review: true,
            hipaa_notification_required: true
          }
        });
      }

      return true;
    } catch (error) {
      console.error('Emergency response trigger failed:', error);
      return false;
    }
  }, [profile]);

  // Quick incident templates
  const createDataBreachIncident = useCallback(async (
    description: string, 
    affectedResources: string[]
  ) => {
    return createIncident({
      type: 'data_breach',
      severity: 'critical',
      description,
      affectedResources,
      metadata: {
        requires_hipaa_notification: true,
        requires_legal_review: true,
        potential_phi_exposure: true
      }
    });
  }, [createIncident]);

  const createUnauthorizedAccessIncident = useCallback(async (
    description: string,
    severity: IncidentData['severity'] = 'high'
  ) => {
    return createIncident({
      type: 'unauthorized_access',
      severity,
      description,
      metadata: {
        requires_access_review: true,
        potential_account_compromise: true
      }
    });
  }, [createIncident]);

  const createSystemCompromiseIncident = useCallback(async (description: string) => {
    return createIncident({
      type: 'system_compromise',
      severity: 'critical',
      description,
      metadata: {
        requires_system_isolation: true,
        requires_forensic_analysis: true,
        potential_malware: true
      }
    });
  }, [createIncident]);

  return {
    incidents,
    loading,
    hasIncidentPermissions,
    createIncident,
    listIncidents,
    updateIncident,
    resolveIncident,
    triggerEmergencyResponse,
    // Quick incident creators
    createDataBreachIncident,
    createUnauthorizedAccessIncident,
    createSystemCompromiseIncident
  };
};