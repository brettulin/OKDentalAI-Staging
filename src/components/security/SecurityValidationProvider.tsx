import React, { createContext, useContext, ReactNode } from 'react';
import { useComprehensiveSecurityMonitoring } from '@/hooks/useComprehensiveSecurityMonitoring';
import { useEnhancedPatientSecurity } from '@/hooks/useEnhancedPatientSecurity';
import { useCallTranscriptSecurity } from '@/hooks/useCallTranscriptSecurity';
import { useCredentialSecurity } from '@/hooks/useCredentialSecurity';

interface SecurityValidationContextType {
  // Comprehensive monitoring
  securityAlerts: any[];
  securityMetrics: any;
  validateComprehensiveAccess: (resourceType: string, resourceId: string, operation: string) => Promise<boolean>;
  createSecurityIncident: (alertType: string, severity: string, description: string, metadata?: any) => Promise<boolean>;
  
  // Patient security
  validatePatientAccess: (patientId: string, operation: string) => Promise<boolean>;
  logPatientAccess: (accessLog: any) => Promise<void>;
  
  // Call transcript security
  validateCallAccess: (callId: string, operation: string) => Promise<boolean>;
  logCallAccess: (accessLog: any) => Promise<void>;
  
  // Credential security
  requestCredentialAccess: (accessRequest: any) => Promise<boolean>;
  validateCredentialAccess: (officeId: string) => boolean;
  revokeCredentialAccess: (officeId: string) => void;
}

const SecurityValidationContext = createContext<SecurityValidationContextType | undefined>(undefined);

interface SecurityValidationProviderProps {
  children: ReactNode;
}

export const SecurityValidationProvider: React.FC<SecurityValidationProviderProps> = ({ children }) => {
  const comprehensiveMonitoring = useComprehensiveSecurityMonitoring();
  const patientSecurity = useEnhancedPatientSecurity();
  const callSecurity = useCallTranscriptSecurity();
  const credentialSecurity = useCredentialSecurity();

  const contextValue: SecurityValidationContextType = {
    // Comprehensive monitoring
    securityAlerts: comprehensiveMonitoring.securityAlerts,
    securityMetrics: comprehensiveMonitoring.securityMetrics,
    validateComprehensiveAccess: comprehensiveMonitoring.validateComprehensiveAccess,
    createSecurityIncident: comprehensiveMonitoring.createSecurityIncident,
    
    // Patient security
    validatePatientAccess: patientSecurity.validatePatientAccess,
    logPatientAccess: patientSecurity.logPatientAccess,
    
    // Call transcript security
    validateCallAccess: callSecurity.validateCallAccess,
    logCallAccess: callSecurity.logCallAccess,
    
    // Credential security
    requestCredentialAccess: credentialSecurity.requestCredentialAccess,
    validateCredentialAccess: credentialSecurity.validateCredentialAccess,
    revokeCredentialAccess: credentialSecurity.revokeCredentialAccess,
  };

  return (
    <SecurityValidationContext.Provider value={contextValue}>
      {children}
    </SecurityValidationContext.Provider>
  );
};

export const useSecurityValidation = () => {
  const context = useContext(SecurityValidationContext);
  if (context === undefined) {
    throw new Error('useSecurityValidation must be used within a SecurityValidationProvider');
  }
  return context;
};

// HOC for components that need security validation
export const withSecurityValidation = <P extends object>(
  Component: React.ComponentType<P>
) => {
  return (props: P) => (
    <SecurityValidationProvider>
      <Component {...props} />
    </SecurityValidationProvider>
  );
};