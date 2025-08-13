import React, { forwardRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { sanitizeInput } from '@/utils/encryption';
import { cn } from '@/lib/utils';
import { Shield, AlertTriangle } from 'lucide-react';

interface SecureInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  sanitize?: boolean;
  maxLength?: number;
  enableXSSProtection?: boolean;
  validateInput?: (value: string) => string | null;
  showSecurityIndicator?: boolean;
}

const SecureInput = forwardRef<HTMLInputElement, SecureInputProps>(
  ({ 
    className, 
    type, 
    sanitize = true, 
    maxLength = 1000, 
    enableXSSProtection = true,
    validateInput,
    showSecurityIndicator = false,
    onChange, 
    ...props 
  }, ref) => {
    const [validationError, setValidationError] = useState<string | null>(null);
    const [isSecure, setIsSecure] = useState(true);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let value = e.target.value;
      
      // XSS Protection
      if (enableXSSProtection) {
        const hasXSSPattern = /<script|javascript:|on\w+\s*=|<iframe|<object|<embed/i.test(value);
        if (hasXSSPattern) {
          setIsSecure(false);
          setValidationError('Potentially unsafe input detected');
          return;
        }
      }

      // Custom validation
      if (validateInput) {
        const error = validateInput(value);
        if (error) {
          setValidationError(error);
          setIsSecure(false);
        } else {
          setValidationError(null);
          setIsSecure(true);
        }
      }

      // Sanitization
      if (sanitize) {
        value = sanitizeInput(value);
      }

      if (onChange) {
        const syntheticEvent = {
          ...e,
          target: {
            ...e.target,
            value: value
          }
        };
        onChange(syntheticEvent);
      }
    };

    return (
      <div className="relative">
        <Input
          type={type}
          className={cn(
            className,
            !isSecure && "border-destructive",
            showSecurityIndicator && "pr-10"
          )}
          ref={ref}
          maxLength={maxLength}
          onChange={handleChange}
          {...props}
        />
        {showSecurityIndicator && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {isSecure ? (
              <Shield className="h-4 w-4 text-success" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            )}
          </div>
        )}
        {validationError && (
          <p className="text-sm text-destructive mt-1">{validationError}</p>
        )}
      </div>
    );
  }
);

SecureInput.displayName = "SecureInput";

export { SecureInput };