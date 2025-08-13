import { useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSecurityAudit } from '@/hooks/useSecurityAudit';
import { supabase } from '@/integrations/supabase/client';

interface StaffAuthorizationCheck {
  userId?: string;
  resourceId: string;
  resourceType: 'patient' | 'call' | 'appointment' | 'sensitive_data';
  operation: string;
}

export const useStaffAuthorization = () => {
  const { profile } = useAuth();
  const { logAccess } = useSecurityAudit();

  // Enhanced patient assignment validation
  const validatePatientAssignment = useCallback(async (patientId: string, userId?: string): Promise<boolean> => {
    const targetUserId = userId || profile?.user_id;
    if (!targetUserId || !profile?.clinic_id) return false;

    try {
      // Check if user is assigned to patient through appointments
      const { data: assignedAppointments } = await supabase
        .from('appointments')
        .select('id, patient_id')
        .eq('patient_id', patientId)
        .eq('clinic_id', profile.clinic_id);

      // Check if user is assigned to patient through calls
      const { data: assignedCalls } = await supabase
        .from('calls')
        .select('id, caller_phone')
        .eq('assigned_to', targetUserId)
        .eq('clinic_id', profile.clinic_id);

      // Get patient phone to match with calls
      const { data: patient } = await supabase
        .from('patients')
        .select('phone')
        .eq('id', patientId)
        .single();

      const hasAppointmentAssignment = assignedAppointments && assignedAppointments.length > 0;
      const hasCallAssignment = assignedCalls && patient && 
        assignedCalls.some(call => call.caller_phone === patient.phone);

      return hasAppointmentAssignment || hasCallAssignment;
    } catch (error) {
      console.error('Patient assignment validation failed:', error);
      return false;
    }
  }, [profile]);

  // Time-based access restrictions (business hours check)
  const validateBusinessHours = useCallback((): boolean => {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay(); // 0 = Sunday, 6 = Saturday

    // Business hours: Monday-Friday 7 AM - 7 PM
    const isBusinessDay = day >= 1 && day <= 5;
    const isBusinessHour = hour >= 7 && hour <= 19;

    return isBusinessDay && isBusinessHour;
  }, []);

  // Supervisor approval requirement check
  const requiresSupervisorApproval = useCallback((operation: string, resourceType: string): boolean => {
    const highRiskOperations = [
      'delete_patient',
      'export_sensitive_data',
      'modify_medical_records',
      'access_all_patients',
      'credential_management'
    ];

    const sensitiveResources = ['patient', 'medical_record', 'pms_credentials'];

    return highRiskOperations.includes(operation) || 
           (sensitiveResources.includes(resourceType) && !validateBusinessHours());
  }, [validateBusinessHours]);

  // Comprehensive staff authorization check
  const validateStaffAuthorization = useCallback(async (check: StaffAuthorizationCheck): Promise<{
    authorized: boolean;
    reason?: string;
    requiresSupervisorApproval?: boolean;
  }> => {
    if (!profile?.clinic_id) {
      return { authorized: false, reason: 'No clinic association' };
    }

    // Always allow owners and doctors
    if (profile.role === 'owner' || profile.role === 'doctor') {
      await logAccess({
        action_type: 'staff_authorization_granted',
        resource_type: check.resourceType,
        resource_id: check.resourceId,
        metadata: {
          operation: check.operation,
          authorization_type: 'role_based',
          user_role: profile.role
        }
      });
      return { authorized: true };
    }

    // Check business hours for sensitive operations
    if (!validateBusinessHours() && check.resourceType === 'patient') {
      await logAccess({
        action_type: 'staff_authorization_denied',
        resource_type: check.resourceType,
        resource_id: check.resourceId,
        metadata: {
          operation: check.operation,
          reason: 'outside_business_hours',
          current_time: new Date().toISOString()
        }
      });
      return { 
        authorized: false, 
        reason: 'Access to patient data is restricted outside business hours',
        requiresSupervisorApproval: true
      };
    }

    // Patient-specific checks
    if (check.resourceType === 'patient') {
      const hasAssignment = await validatePatientAssignment(check.resourceId, check.userId);
      
      if (!hasAssignment) {
        await logAccess({
          action_type: 'staff_authorization_denied',
          resource_type: check.resourceType,
          resource_id: check.resourceId,
          metadata: {
            operation: check.operation,
            reason: 'no_patient_assignment',
            user_role: profile.role
          }
        });
        return { 
          authorized: false, 
          reason: 'You are not assigned to this patient' 
        };
      }
    }

    // Check for supervisor approval requirements
    const needsApproval = requiresSupervisorApproval(check.operation, check.resourceType);
    
    if (needsApproval) {
      await logAccess({
        action_type: 'staff_authorization_pending',
        resource_type: check.resourceType,
        resource_id: check.resourceId,
        metadata: {
          operation: check.operation,
          requires_supervisor_approval: true,
          user_role: profile.role
        }
      });
      return { 
        authorized: false, 
        reason: 'This operation requires supervisor approval',
        requiresSupervisorApproval: true
      };
    }

    // Authorization granted
    await logAccess({
      action_type: 'staff_authorization_granted',
      resource_type: check.resourceType,
      resource_id: check.resourceId,
      metadata: {
        operation: check.operation,
        authorization_type: 'assignment_based',
        user_role: profile.role
      }
    });

    return { authorized: true };
  }, [profile, logAccess, validatePatientAssignment, validateBusinessHours, requiresSupervisorApproval]);

  // Create access exception log
  const logAccessException = useCallback(async (check: StaffAuthorizationCheck, justification: string) => {
    await logAccess({
      action_type: 'access_exception_granted',
      resource_type: check.resourceType,
      resource_id: check.resourceId,
      metadata: {
        operation: check.operation,
        justification,
        user_role: profile?.role,
        exception_timestamp: new Date().toISOString(),
        risk_level: 'elevated'
      }
    });
  }, [logAccess, profile]);

  return {
    validateStaffAuthorization,
    validatePatientAssignment,
    validateBusinessHours,
    requiresSupervisorApproval,
    logAccessException
  };
};