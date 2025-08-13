import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Shield } from 'lucide-react';

interface RateLimitedButtonProps extends React.ComponentProps<typeof Button> {
  actionType: string;
  limit?: number;
  windowMinutes?: number;
  onAction: () => Promise<void> | void;
  children: React.ReactNode;
}

export const RateLimitedButton: React.FC<RateLimitedButtonProps> = ({
  actionType,
  limit = 10,
  windowMinutes = 60,
  onAction,
  children,
  disabled,
  ...props
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleClick = async () => {
    if (isLoading || disabled) return;

    setIsLoading(true);
    
    try {
      // Check rate limit
      const { data: canProceed, error } = await supabase.rpc('check_rate_limit', {
        p_action_type: actionType,
        p_limit: limit,
        p_window_minutes: windowMinutes
      });

      if (error) {
        throw error;
      }

      if (!canProceed) {
        toast({
          title: "Rate limit exceeded",
          description: `You can only perform this action ${limit} times per ${windowMinutes} minutes. Please try again later.`,
          variant: "destructive",
        });
        return;
      }

      // Execute the action
      await onAction();

    } catch (error) {
      console.error('Rate limited action error:', error);
      toast({
        title: "Action failed",
        description: "An error occurred while performing this action.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      {...props}
      disabled={disabled || isLoading}
      onClick={handleClick}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Processing...
        </>
      ) : (
        children
      )}
    </Button>
  );
};