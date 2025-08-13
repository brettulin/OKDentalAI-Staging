import React, { useEffect, useState } from 'react';
import { useCallTranscriptSecurity } from '@/hooks/useCallTranscriptSecurity';
import { useStaffAuthorization } from '@/hooks/useStaffAuthorization';
import { 
  Drawer, 
  DrawerContent, 
  DrawerDescription, 
  DrawerHeader, 
  DrawerTitle,
  DrawerTrigger
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useSecurity } from '@/components/security/SecurityProvider';
import { MessageSquare, User, Bot, Clock, Shield, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Turn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  at: string;
  meta?: any;
}

interface Call {
  id: string;
  started_at: string;
  ended_at?: string;
  outcome?: string;
  transcript_json?: any;
}

interface CallThreadDrawerProps {
  call: Call;
  children: React.ReactNode;
}

export const CallThreadDrawer = ({ call, children }: CallThreadDrawerProps) => {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [accessGranted, setAccessGranted] = useState<boolean | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  const { logSecurityEvent } = useSecurity();
  const { validateCallAccess, logCallAccess } = useCallTranscriptSecurity();
  const { validateStaffAuthorization } = useStaffAuthorization();

  const fetchTurns = async () => {
    if (!call.id || accessGranted !== true) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('turns')
        .select('*')
        .eq('call_id', call.id)
        .order('at', { ascending: true });

      if (error) throw error;
      setTurns((data || []).map(turn => ({
        ...turn,
        role: turn.role as 'user' | 'assistant'
      })));
    } catch (error) {
      console.error('Error fetching turns:', error);
    } finally {
      setLoading(false);
    }
  };

  // Validate access when drawer opens
  const handleOpenChange = async (open: boolean) => {
    if (open && accessGranted === null) {
      try {
        // Enhanced authorization check
        const authResult = await validateStaffAuthorization({
          resourceId: call.id,
          resourceType: 'call',
          operation: 'view_transcript'
        });

        if (!authResult.authorized) {
          setAccessError(authResult.reason || 'Access denied');
          setAccessGranted(false);
          return;
        }

        // Call transcript specific validation
        const hasAccess = await validateCallAccess(call.id, 'view');
        setAccessGranted(hasAccess);

        if (hasAccess) {
          // Log the transcript access
          await logCallAccess({
            callId: call.id,
            operation: 'view',
            metadata: { drawer_access: true }
          });
          
          // Log general security event
          logSecurityEvent('view_transcript', 'call', call.id);
        } else {
          setAccessError('You do not have permission to view this call transcript');
        }
      } catch (error) {
        console.error('Access validation failed:', error);
        setAccessError('Access validation failed');
        setAccessGranted(false);
      }
    }
    
    setIsOpen(open && (accessGranted !== false));
  };

  useEffect(() => {
    if (accessGranted === true) {
      fetchTurns();
    }
  }, [accessGranted, call.id]);

  useEffect(() => {
    if (!isOpen || !call.id || accessGranted !== true) return;

    // Set up real-time subscription for new turns
    const channel = supabase
      .channel(`call-turns-${call.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'turns',
          filter: `call_id=eq.${call.id}`,
        },
        (payload) => {
          const newTurn = {
            ...payload.new,
            role: payload.new.role as 'user' | 'assistant'
          } as Turn;
          setTurns(prev => [...prev, newTurn]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, call.id, accessGranted]);

  const getDuration = () => {
    const start = new Date(call.started_at);
    const end = call.ended_at ? new Date(call.ended_at) : new Date();
    const duration = Math.round((end.getTime() - start.getTime()) / 60000);
    return `${duration} min`;
  };

  const getCallStatus = () => {
    if (call.outcome) {
      return call.outcome;
    }
    return call.ended_at ? 'completed' : 'ongoing';
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'appointment_booked':
        return 'default';
      case 'ongoing':
        return 'secondary';
      case 'transferred':
        return 'outline';
      case 'voicemail':
        return 'outline';
      case 'completed':
        return 'default';
      default:
        return 'secondary';
    }
  };

  return (
    <>
      {accessError && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <span>{accessError}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAccessError(null)}
              >
                Dismiss
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      <Drawer open={isOpen} onOpenChange={handleOpenChange}>
        <DrawerTrigger asChild>
          {children}
        </DrawerTrigger>
        <DrawerContent className="h-[85vh]">
          <DrawerHeader className="border-b">
            <div className="flex items-center justify-between">
              <div>
                <DrawerTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Call #{call.id.slice(-8)}
                  {accessGranted && <span title="Secure access validated"><Shield className="h-4 w-4 text-green-600" /></span>}
                </DrawerTitle>
                <DrawerDescription className="flex items-center gap-4 mt-2">
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    Started {formatDistanceToNow(new Date(call.started_at), { addSuffix: true })}
                  </span>
                  <span>Duration: {getDuration()}</span>
                  <Badge variant={getStatusVariant(getCallStatus())}>
                    {getCallStatus()}
                  </Badge>
                </DrawerDescription>
              </div>
            </div>
          </DrawerHeader>
          
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full p-6">
              {loading ? (
                <div className="text-center text-muted-foreground">Loading conversation...</div>
              ) : accessGranted === false ? (
                <div className="text-center text-muted-foreground">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-destructive" />
                  <p>Access denied to view call transcript</p>
                </div>
              ) : turns.length === 0 ? (
                <div className="text-center text-muted-foreground">No conversation yet</div>
              ) : (
                <div className="space-y-4">
                  {turns.map((turn) => (
                    <div
                      key={turn.id}
                      className={`flex gap-3 ${
                        turn.role === 'assistant' ? 'flex-row' : 'flex-row-reverse'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        turn.role === 'assistant' 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-secondary text-secondary-foreground'
                      }`}>
                        {turn.role === 'assistant' ? (
                          <Bot className="h-4 w-4" />
                        ) : (
                          <User className="h-4 w-4" />
                        )}
                      </div>
                      <div className={`flex-1 max-w-[80%] ${
                        turn.role === 'assistant' ? 'text-left' : 'text-right'
                      }`}>
                        <div className={`rounded-lg p-3 ${
                          turn.role === 'assistant'
                            ? 'bg-muted text-muted-foreground'
                            : 'bg-primary text-primary-foreground'
                        }`}>
                          <p className="text-sm">{turn.text}</p>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(turn.at), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
};