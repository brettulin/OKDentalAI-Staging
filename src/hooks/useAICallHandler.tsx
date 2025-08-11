import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface CallContext {
  callId: string;
  officeId: string;
  patientPhone?: string;
  conversationState: 'greeting' | 'patient_lookup' | 'patient_creation' | 'appointment_booking' | 'confirmation';
  patientData?: any;
  selectedProvider?: string;
  selectedLocation?: string;
  selectedSlot?: any;
  appointmentData?: any;
}

interface CallTurn {
  id: string;
  call_id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  at: string;
  meta?: any;
}

interface Call {
  id: string;
  clinic_id: string;
  office_id?: string;
  twilio_call_sid?: string;
  started_at: string;
  ended_at?: string;
  outcome?: string;
  transcript_json?: any;
}

export function useAICallHandler() {
  const queryClient = useQueryClient();

  // Start a new call
  const startCallMutation = useMutation({
    mutationFn: async (params: {
      callId: string;
      officeId: string;
      twilioCallSid?: string;
      fromNumber?: string;
      toNumber?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('call-manager', {
        body: {
          action: 'start_call',
          ...params,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calls'] });
    },
  });

  // Process user message through AI
  const processMessageMutation = useMutation({
    mutationFn: async (params: {
      callId: string;
      officeId: string;
      userMessage: string;
      conversationHistory?: CallTurn[];
      context?: Partial<CallContext>;
    }) => {
      const { data, error } = await supabase.functions.invoke('ai-call-handler', {
        body: {
          type: 'process_message',
          ...params
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'AI processing failed');
      return data;
    },
  });

  // End a call
  const endCallMutation = useMutation({
    mutationFn: async (params: {
      callId: string;
      outcome?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('call-manager', {
        body: {
          action: 'end_call',
          ...params,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calls'] });
    },
  });

  // Get call history
  const useCallHistory = (callId: string) => {
    return useQuery({
      queryKey: ['call-history', callId],
      queryFn: async () => {
        const { data, error } = await supabase.functions.invoke('call-manager', {
          body: {
            action: 'get_call_history',
            callId,
          },
        });

        if (error) throw error;
        return data;
      },
      enabled: !!callId,
    });
  };

  // Get all calls for current clinic
  const useCallsList = () => {
    return useQuery({
      queryKey: ['calls'],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('calls')
          .select(`
            *,
            turns:turns(count)
          `)
          .order('started_at', { ascending: false });

        if (error) throw error;
        return data as (Call & { turns: { count: number }[] })[];
      },
    });
  };

  // Update call outcome
  const updateCallOutcomeMutation = useMutation({
    mutationFn: async (params: {
      callId: string;
      outcome?: string;
      transcriptJson?: any;
    }) => {
      const { data, error } = await supabase.functions.invoke('call-manager', {
        body: {
          action: 'update_call_outcome',
          ...params,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calls'] });
    },
  });

  // Real-time subscription to call turns
  const subscribeToCallTurns = (callId: string, onNewTurn: (turn: CallTurn) => void) => {
    return supabase
      .channel(`call-turns-${callId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'turns',
          filter: `call_id=eq.${callId}`,
        },
        (payload) => {
          onNewTurn(payload.new as CallTurn);
        }
      )
      .subscribe();
  };

  return {
    // Call management
    startCall: startCallMutation.mutateAsync,
    endCall: endCallMutation.mutateAsync,
    updateCallOutcome: updateCallOutcomeMutation.mutateAsync,
    
    // AI processing
    processMessage: processMessageMutation.mutateAsync,
    
    // Data fetching
    useCallHistory,
    useCallsList,
    
    // Real-time
    subscribeToCallTurns,
    
    // Loading states
    isStartingCall: startCallMutation.isPending,
    isProcessingMessage: processMessageMutation.isPending,
    isEndingCall: endCallMutation.isPending,
  };
}