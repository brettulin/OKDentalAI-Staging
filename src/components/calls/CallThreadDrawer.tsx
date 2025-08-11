import React, { useEffect, useState } from 'react';
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
import { supabase } from '@/integrations/supabase/client';
import { MessageSquare, User, Bot, Clock } from 'lucide-react';
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

  const fetchTurns = async () => {
    if (!call.id) return;
    
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

  useEffect(() => {
    if (isOpen) {
      fetchTurns();
    }
  }, [isOpen, call.id]);

  useEffect(() => {
    if (!isOpen || !call.id) return;

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
  }, [isOpen, call.id]);

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
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
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
  );
};