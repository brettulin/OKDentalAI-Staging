import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Invite {
  id: string;
  email: string;
  clinic_name: string;
  expires_at: string;
  accepted_at: string | null;
  invite_code: string;
}

export function useInvites() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchInvites = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('invites')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvites(data || []);
    } catch (error) {
      console.error('Error fetching invites:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch invites',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const acceptInvite = async (inviteCode: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('accept_invite', {
        p_invite_code: inviteCode
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: 'Success',
          description: `Welcome to ${data.clinic_name}!`,
        });
        await fetchInvites();
        return data;
      } else {
        throw new Error(data?.error || 'Failed to accept invite');
      }
    } catch (error) {
      console.error('Error accepting invite:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to accept invite',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const createClinic = async (clinicName: string, inviteCode?: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('create_clinic_for_new_user', {
        p_clinic_name: clinicName,
        p_invite_code: inviteCode
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Clinic "${clinicName}" created successfully!`,
      });

      return data;
    } catch (error) {
      console.error('Error creating clinic:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create clinic',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvites();
  }, []);

  return {
    invites,
    loading,
    fetchInvites,
    acceptInvite,
    createClinic,
  };
}