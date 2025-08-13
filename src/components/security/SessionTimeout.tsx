import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Clock, Shield } from 'lucide-react';

interface SessionTimeoutProps {
  timeoutMinutes?: number;
  warningMinutes?: number;
  onTimeout?: () => void;
}

export const SessionTimeout: React.FC<SessionTimeoutProps> = ({
  timeoutMinutes = 30,
  warningMinutes = 5,
  onTimeout
}) => {
  const { signOut } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [remainingTime, setRemainingTime] = useState(warningMinutes * 60);
  const [lastActivity, setLastActivity] = useState(Date.now());

  useEffect(() => {
    const timeoutMs = timeoutMinutes * 60 * 1000;
    const warningMs = warningMinutes * 60 * 1000;

    const resetActivity = () => {
      setLastActivity(Date.now());
      setShowWarning(false);
    };

    const checkActivity = () => {
      const now = Date.now();
      const timeSinceActivity = now - lastActivity;
      
      if (timeSinceActivity >= timeoutMs) {
        // Session expired
        handleTimeout();
      } else if (timeSinceActivity >= (timeoutMs - warningMs)) {
        // Show warning
        const remaining = Math.ceil((timeoutMs - timeSinceActivity) / 1000);
        setRemainingTime(remaining);
        setShowWarning(true);
      }
    };

    const handleTimeout = async () => {
      setShowWarning(false);
      if (onTimeout) {
        onTimeout();
      } else {
        await signOut();
      }
    };

    // Activity listeners
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, resetActivity, true);
    });

    // Check activity every 30 seconds
    const interval = setInterval(checkActivity, 30000);

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, resetActivity, true);
      });
      clearInterval(interval);
    };
  }, [lastActivity, timeoutMinutes, warningMinutes, onTimeout, signOut]);

  useEffect(() => {
    if (showWarning && remainingTime > 0) {
      const countdown = setInterval(() => {
        setRemainingTime(prev => {
          if (prev <= 1) {
            clearInterval(countdown);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(countdown);
    }
  }, [showWarning, remainingTime]);

  const extendSession = () => {
    setLastActivity(Date.now());
    setShowWarning(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={showWarning} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-warning" />
            Session Timeout Warning
          </DialogTitle>
          <DialogDescription>
            Your session will expire soon due to inactivity. This is a security measure to protect sensitive patient data.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-2xl font-mono font-bold text-destructive">
              {formatTime(remainingTime)}
            </div>
            <p className="text-sm text-muted-foreground">Time remaining</p>
          </div>
          
          <Progress 
            value={(remainingTime / (warningMinutes * 60)) * 100} 
            className="w-full"
          />
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="h-4 w-4" />
            <span>HIPAA compliance requires automatic session timeout</span>
          </div>
          
          <div className="flex gap-2">
            <Button onClick={extendSession} className="flex-1">
              Continue Session
            </Button>
            <Button variant="outline" onClick={signOut} className="flex-1">
              Sign Out Now
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};