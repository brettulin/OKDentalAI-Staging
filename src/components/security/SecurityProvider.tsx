import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSecurityAudit } from '@/hooks/useSecurityAudit';

interface SecurityContextType {
  hasPermission: (action: string, resource?: string) => boolean;
  logSecurityEvent: (action: string, resource: string, resourceId?: string) => void;
  isHighRiskAction: (action: string) => boolean;
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

const HIGH_RISK_ACTIONS = [
  'delete_patient',
  'export_data',
  'view_all_calls',
  'modify_user_roles',
  'admin_role_change',
  'pms_credential_access'
];

// Enhanced role permissions with admin role support
const ROLE_PERMISSIONS = {
  owner: ['all'],
  admin: ['view_patients', 'create_patients', 'update_patients', 'view_calls', 'view_appointments', 'manage_clinic_settings'],
  doctor: ['view_patients', 'create_patients', 'update_patients', 'view_calls', 'create_calls', 'view_appointments'],
  nurse: ['view_patients', 'create_patients', 'update_patients', 'view_calls', 'view_appointments'],
  medical_assistant: ['view_patients', 'create_patients', 'update_patients', 'view_appointments'],
  staff: ['view_appointments']
};

// Admin role specific permissions
const ADMIN_PERMISSIONS = {
  technical_admin: ['manage_users', 'manage_pms_integration', 'view_audit_logs'],
  medical_admin: ['manage_medical_data', 'view_audit_logs'],
  clinic_admin: ['manage_clinic_settings', 'view_audit_logs']
};

export const SecurityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const { logAccess } = useSecurityAudit();
  const [sessionTimeout, setSessionTimeout] = useState<NodeJS.Timeout | null>(null);

  // Session timeout for sensitive operations (30 minutes)
  const SESSION_TIMEOUT = 30 * 60 * 1000;

  useEffect(() => {
    const resetTimeout = () => {
      if (sessionTimeout) clearTimeout(sessionTimeout);
      
      const timeout = setTimeout(() => {
        // For high-risk operations, force re-authentication
        if (window.location.pathname.includes('/patients') || 
            window.location.pathname.includes('/calls')) {
          console.log('Session timeout - consider re-authentication for sensitive operations');
        }
      }, SESSION_TIMEOUT);
      
      setSessionTimeout(timeout);
    };

    // Reset timeout on user activity
    const handleActivity = () => resetTimeout();
    
    ['click', 'keypress', 'scroll', 'mousemove'].forEach(event => {
      document.addEventListener(event, handleActivity);
    });

    resetTimeout();

    return () => {
      if (sessionTimeout) clearTimeout(sessionTimeout);
      ['click', 'keypress', 'scroll', 'mousemove'].forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [profile]);

  const hasPermission = (action: string, resource?: string): boolean => {
    if (!profile?.role) return false;
    
    const permissions = ROLE_PERMISSIONS[profile.role as keyof typeof ROLE_PERMISSIONS] || [];
    
    // Owner has all permissions
    if (permissions.includes('all')) return true;
    
    // Check base role permissions
    if (permissions.includes(action)) return true;
    
    // Check admin role permissions
    if (profile.admin_role) {
      const adminPermissions = ADMIN_PERMISSIONS[profile.admin_role as keyof typeof ADMIN_PERMISSIONS] || [];
      return adminPermissions.includes(action);
    }
    
    return false;
  };

  const logSecurityEvent = async (action: string, resource: string, resourceId?: string) => {
    const riskLevel = isHighRiskAction(action) ? 'elevated' : 'normal';
    
    await logAccess({
      action_type: action,
      resource_type: resource,
      resource_id: resourceId,
      metadata: {
        risk_level: riskLevel,
        timestamp: new Date().toISOString(),
        user_role: profile?.role
      }
    });
  };

  const isHighRiskAction = (action: string): boolean => {
    return HIGH_RISK_ACTIONS.includes(action);
  };

  return (
    <SecurityContext.Provider value={{
      hasPermission,
      logSecurityEvent,
      isHighRiskAction
    }}>
      {children}
    </SecurityContext.Provider>
  );
};

export const useSecurity = () => {
  const context = useContext(SecurityContext);
  if (context === undefined) {
    throw new Error('useSecurity must be used within a SecurityProvider');
  }
  return context;
};