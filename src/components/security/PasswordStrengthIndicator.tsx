import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertTriangle } from 'lucide-react';
import { validatePasswordStrength, getPasswordStrengthText, getPasswordStrengthColor } from '@/utils/passwordValidation';

interface PasswordStrengthIndicatorProps {
  password: string;
  showFeedback?: boolean;
}

export const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({
  password,
  showFeedback = true
}) => {
  const strength = validatePasswordStrength(password);
  
  if (!password) return null;

  const progressValue = (strength.score / 4) * 100;
  const strengthText = getPasswordStrengthText(strength.score);
  const strengthColor = getPasswordStrengthColor(strength.score);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Password Strength</span>
        <span className={`text-sm font-medium ${strengthColor}`}>
          {strengthText}
        </span>
      </div>
      
      <Progress 
        value={progressValue} 
        className="h-2"
      />
      
      {showFeedback && strength.feedback.length > 0 && (
        <Alert className="mt-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <div className="font-medium">To improve password security:</div>
              <ul className="list-disc list-inside text-sm space-y-0.5">
                {strength.feedback.map((feedback, index) => (
                  <li key={index}>{feedback}</li>
                ))}
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      {strength.isStrong && (
        <Alert className="mt-2 border-green-200 bg-green-50">
          <Shield className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Strong password! This meets healthcare security requirements.
          </AlertDescription>
        </Alert>
      )}
      
      <div className="text-xs text-muted-foreground mt-2">
        Healthcare systems require strong passwords to protect patient data and comply with HIPAA regulations.
      </div>
    </div>
  );
};