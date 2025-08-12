import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export const SecurityBanner: React.FC = () => {
  const { profile } = useAuth();

  // Show security reminder for medical staff accessing sensitive data
  if (!profile || !['owner', 'doctor', 'nurse', 'medical_assistant'].includes(profile.role)) {
    return null;
  }

  return (
    <Alert className="mb-4 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
      <Shield className="h-4 w-4 text-amber-600" />
      <AlertDescription className="text-amber-800 dark:text-amber-200">
        <strong>Security Notice:</strong> You are accessing sensitive patient data. 
        All actions are logged and monitored for compliance. Please follow HIPAA guidelines.
      </AlertDescription>
    </Alert>
  );
};