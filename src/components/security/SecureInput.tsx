import React, { forwardRef } from 'react';
import { Input } from '@/components/ui/input';
import { sanitizeInput } from '@/utils/encryption';
import { cn } from '@/lib/utils';

interface SecureInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  sanitize?: boolean;
  maxLength?: number;
}

const SecureInput = forwardRef<HTMLInputElement, SecureInputProps>(
  ({ className, type, sanitize = true, maxLength = 1000, onChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (sanitize && onChange) {
        const sanitizedValue = sanitizeInput(e.target.value);
        const syntheticEvent = {
          ...e,
          target: {
            ...e.target,
            value: sanitizedValue
          }
        };
        onChange(syntheticEvent);
      } else if (onChange) {
        onChange(e);
      }
    };

    return (
      <Input
        type={type}
        className={cn(className)}
        ref={ref}
        maxLength={maxLength}
        onChange={handleChange}
        {...props}
      />
    );
  }
);

SecureInput.displayName = "SecureInput";

export { SecureInput };