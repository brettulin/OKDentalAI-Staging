import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';

interface CallStatusUpdate {
  id: string;
  status: string;
  caller_phone?: string;
  assigned_to?: string;
  started_at: string;
  ended_at?: string;
  call_duration_seconds?: number;
  ai_confidence_score?: number;
  outcome?: string;
}

interface UserPresence {
  user_id: string;
  display_name: string;
  status: 'online' | 'busy' | 'away' | 'offline';
  current_call_id?: string;
  last_seen: string;
}

export const useRealtimeCallMonitoring = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  
  const [activeCalls, setActiveCalls] = useState<CallStatusUpdate[]>([]);
  const [staffPresence, setStaffPresence] = useState<Record<string, UserPresence>>({});
  const [callEvents, setCallEvents] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // Real-time call updates subscription
  useEffect(() => {
    if (!profile?.clinic_id) return;

    const channel = supabase
      .channel('call-monitoring')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calls',
          filter: `clinic_id=eq.${profile.clinic_id}`,
        },
        (payload) => {
          console.log('Call update received:', payload);
          
          if (payload.eventType === 'INSERT') {
            const newCall = payload.new as CallStatusUpdate;
            setActiveCalls(prev => [...prev, newCall]);
            
            // Notify about new incoming call
            if (newCall.status === 'incoming') {
              toast({
                title: "New Incoming Call",
                description: `Call from ${newCall.caller_phone || 'Unknown number'}`,
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedCall = payload.new as CallStatusUpdate;
            setActiveCalls(prev => 
              prev.map(call => 
                call.id === updatedCall.id ? updatedCall : call
              )
            );
            
            // Notify about status changes
            if (payload.old?.status !== updatedCall.status) {
              toast({
                title: "Call Status Updated",
                description: `Call ${updatedCall.id.slice(0, 8)} is now ${updatedCall.status}`,
              });
            }
          } else if (payload.eventType === 'DELETE') {
            setActiveCalls(prev => 
              prev.filter(call => call.id !== payload.old.id)
            );
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_events',
        },
        (payload) => {
          console.log('Call event received:', payload);
          setCallEvents(prev => [payload.new, ...prev.slice(0, 49)]); // Keep last 50 events
        }
      )
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState();
        console.log('Presence sync:', presenceState);
        
        // Transform presence data to UserPresence format
        const transformedPresence: Record<string, UserPresence> = {};
        Object.entries(presenceState).forEach(([key, presences]) => {
          if (presences && presences.length > 0 && presences[0]) {
            const presence = presences[0] as any;
            transformedPresence[key] = {
              user_id: presence.user_id || key,
              display_name: presence.display_name || 'Unknown',
              status: presence.status || 'online',
              current_call_id: presence.current_call_id,
              last_seen: presence.last_seen || new Date().toISOString()
            };
          }
        });
        setStaffPresence(transformedPresence);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined:', key, newPresences);
        if (newPresences && newPresences.length > 0 && newPresences[0]) {
          const presence = newPresences[0] as any;
          setStaffPresence(prev => ({
            ...prev,
            [key]: {
              user_id: presence.user_id || key,
              display_name: presence.display_name || 'Unknown',
              status: presence.status || 'online',
              current_call_id: presence.current_call_id,
              last_seen: presence.last_seen || new Date().toISOString()
            }
          }));
        }
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left:', key, leftPresences);
        setStaffPresence(prev => {
          const newState = { ...prev };
          delete newState[key];
          return newState;
        });
      })
      .subscribe(async (status) => {
        console.log('Channel subscription status:', status);
        setIsConnected(status === 'SUBSCRIBED');
        
        if (status === 'SUBSCRIBED') {
          // Track current user presence
          await channel.track({
            user_id: profile.user_id,
            display_name: profile.display_name || 'Anonymous',
            status: 'online',
            last_seen: new Date().toISOString()
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.clinic_id, profile?.user_id, profile?.display_name, toast]);

  // Load initial active calls
  useEffect(() => {
    if (!profile?.clinic_id) return;

    const loadActiveCalls = async () => {
      const { data, error } = await supabase
        .from('calls')
        .select('*')
        .eq('clinic_id', profile.clinic_id)
        .in('status', ['incoming', 'in_progress', 'on_hold'])
        .order('started_at', { ascending: false });

      if (error) {
        console.error('Error loading active calls:', error);
        return;
      }

      setActiveCalls(data || []);
    };

    loadActiveCalls();
  }, [profile?.clinic_id]);

  // Update user status
  const updateStatus = useCallback(async (status: UserPresence['status'], currentCallId?: string) => {
    const channel = supabase.channel('call-monitoring');
    await channel.track({
      user_id: profile?.user_id,
      display_name: profile?.display_name || 'Anonymous',
      status,
      current_call_id: currentCallId,
      last_seen: new Date().toISOString()
    });
  }, [profile?.user_id, profile?.display_name]);

  // Assign call to staff member
  const assignCall = useCallback(async (callId: string, userId: string) => {
    const { error } = await supabase
      .from('calls')
      .update({ 
        assigned_to: userId,
        status: 'in_progress'
      })
      .eq('id', callId);

    if (error) {
      console.error('Error assigning call:', error);
      toast({
        title: "Error",
        description: "Failed to assign call",
        variant: "destructive",
      });
      return false;
    }

    return true;
  }, [toast]);

  // Update call status
  const updateCallStatus = useCallback(async (callId: string, status: string, additionalData?: any) => {
    const updateData = { status, ...additionalData };
    
    const { error } = await supabase
      .from('calls')
      .update(updateData)
      .eq('id', callId);

    if (error) {
      console.error('Error updating call status:', error);
      toast({
        title: "Error",
        description: "Failed to update call status",
        variant: "destructive",
      });
      return false;
    }

    return true;
  }, [toast]);

  return {
    activeCalls,
    staffPresence,
    callEvents,
    isConnected,
    updateStatus,
    assignCall,
    updateCallStatus,
  };
};