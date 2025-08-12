import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, ExternalLink } from 'lucide-react';

interface ErrorAlertProps {
  error: Error | string;
  onRetry?: () => void;
  context?: string;
}

export function ErrorAlert({ error, onRetry, context = "operation" }: ErrorAlertProps) {
  const errorMessage = typeof error === 'string' ? error : error.message;
  
  const getErrorDetails = (message: string) => {
    if (message.includes('credentials') || message.includes('401')) {
      return {
        title: "Authentication Error",
        description: "Invalid CareStack credentials. Please verify Vendor, Account Key, and Account ID.",
        actionLabel: "Check Credentials",
        variant: "destructive" as const
      };
    }
    
    if (message.includes('rate limit') || message.includes('429')) {
      return {
        title: "Rate Limited", 
        description: "CareStack rate limit hit. Please wait a moment and try again.",
        actionLabel: "Retry",
        variant: "default" as const
      };
    }
    
    if (message.includes('unavailable') || message.includes('5')) {
      return {
        title: "Service Unavailable",
        description: "CareStack service is unavailable. Try again shortly.",
        actionLabel: "Retry",
        variant: "default" as const
      };
    }
    
    if (message.includes('timeout')) {
      return {
        title: "Request Timeout",
        description: "The request took too long to complete. Please check your connection and try again.",
        actionLabel: "Retry",
        variant: "default" as const
      };
    }
    
    if (message.includes('circuit breaker')) {
      return {
        title: "Service Protection Active",
        description: "Our system is protecting against service issues. Please wait a moment before trying again.",
        actionLabel: "Wait & Retry",
        variant: "default" as const
      };
    }
    
    return {
      title: "Error",
      description: `An error occurred during ${context}: ${message}`,
      actionLabel: "Retry",
      variant: "destructive" as const
    };
  };

  const details = getErrorDetails(errorMessage);

  return (
    <Alert variant={details.variant} className="my-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{details.title}</AlertTitle>
      <AlertDescription className="mt-2">
        <div className="space-y-3">
          <p>{details.description}</p>
          <div className="flex items-center gap-2">
            {onRetry && (
              <Button
                size="sm"
                variant="outline"
                onClick={onRetry}
                className="gap-2"
              >
                <RefreshCw className="h-3 w-3" />
                {details.actionLabel}
              </Button>
            )}
            {details.title === "Authentication Error" && (
              <Button
                size="sm"
                variant="outline"
                asChild
                className="gap-2"
              >
                <a href="/pms" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3" />
                  PMS Settings
                </a>
              </Button>
            )}
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
}

// Hook for consistent error handling
export function useCareStackErrorHandler() {
  const handleError = (error: Error | string, context?: string) => {
    const message = typeof error === 'string' ? error : error.message;
    console.error(`CareStack Error [${context}]:`, message);
    
    // Log to audit system if needed
    // You can add audit logging here
    
    return message;
  };

  const getRetryDelay = (error: Error | string): number => {
    const message = typeof error === 'string' ? error : error.message;
    
    if (message.includes('rate limit')) {
      return 60000; // 1 minute for rate limits
    }
    
    if (message.includes('circuit breaker')) {
      return 30000; // 30 seconds for circuit breaker
    }
    
    return 5000; // Default 5 seconds
  };

  return { handleError, getRetryDelay };
}