import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface TwilioCall {
  to: string;
  from?: string;
}

interface TwilioSMS {
  to: string;
  body: string;
  from?: string;
}

export const useTwilioIntegration = () => {
  const { toast } = useToast();

  // Make outbound call
  const makeCallMutation = useMutation({
    mutationFn: async ({ to, from }: TwilioCall) => {
      const { data, error } = await supabase.functions.invoke('twilio-api', {
        body: { action: 'make_call', to, from }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Call Initiated',
        description: `Call started successfully (${data.call_sid})`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Call Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  // Hang up call
  const hangupCallMutation = useMutation({
    mutationFn: async (call_sid: string) => {
      const { data, error } = await supabase.functions.invoke('twilio-api', {
        body: { action: 'hangup_call', call_sid }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: 'Call Ended',
        description: 'Call ended successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  // Send SMS
  const sendSMSMutation = useMutation({
    mutationFn: async ({ to, body, from }: TwilioSMS) => {
      const { data, error } = await supabase.functions.invoke('twilio-api', {
        body: { action: 'send_sms', to, body, from }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: 'SMS Sent',
        description: 'Message sent successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'SMS Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  // Get phone numbers
  const { data: phoneNumbers, isLoading: loadingNumbers } = useQuery({
    queryKey: ['twilio-phone-numbers'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('twilio-api', {
        body: { action: 'get_phone_numbers' }
      });

      if (error) throw error;
      return data.phone_numbers;
    }
  });

  return {
    makeCall: makeCallMutation.mutate,
    hangupCall: hangupCallMutation.mutate,
    sendSMS: sendSMSMutation.mutate,
    phoneNumbers,
    loadingNumbers,
    isCallingInProgress: makeCallMutation.isPending,
    isHangingUp: hangupCallMutation.isPending,
    isSendingSMS: sendSMSMutation.isPending
  };
};