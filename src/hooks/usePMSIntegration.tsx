import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { encryptData, decryptData } from '@/utils/encryption';
import type { Database } from '@/integrations/supabase/types';

type OfficeRow = Database['public']['Tables']['offices']['Row'];
type OfficeInsert = Database['public']['Tables']['offices']['Insert'];
type OfficeUpdate = Database['public']['Tables']['offices']['Update'];

interface PMSCredentials {
  clientId: string;
  clientSecret: string;
  baseUrl?: string;
}

export function usePMSIntegration() {
  const queryClient = useQueryClient();

  // Get offices for current clinic
  const { data: offices, isLoading: officesLoading, refetch: refetchOffices } = useQuery({
    queryKey: ['offices'],
    queryFn: async () => {
      // Get current user's clinic_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('clinic_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.clinic_id) throw new Error('No clinic found');

      const { data, error } = await supabase
        .from('offices')
        .select('*')
        .eq('clinic_id', profile.clinic_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as OfficeRow[];
    },
  });

  // Create or update office (upsert to prevent duplicates)
  const createOfficeMutation = useMutation({
    mutationFn: async (officeData: OfficeInsert) => {
      // Clean up any existing duplicate records first
      const { data: existing } = await supabase
        .from('offices')
        .select('id')
        .eq('clinic_id', officeData.clinic_id!)
        .eq('name', officeData.name);

      if (existing && existing.length > 1) {
        // Keep the first one, delete the rest
        const toDelete = existing.slice(1).map(office => office.id);
        if (toDelete.length > 0) {
          await supabase
            .from('offices')
            .delete()
            .in('id', toDelete);
        }
      }

      const { data, error } = await supabase
        .from('offices')
        .upsert(officeData, {
          onConflict: 'clinic_id,name',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offices'] });
      refetchOffices();
    },
  });

  const updateOfficeMutation = useMutation({
    mutationFn: async ({ id, ...updates }: OfficeUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('offices')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offices'] });
      refetchOffices();
    },
  });

  // PMS operations
  const pmsOperationMutation = useMutation({
    mutationFn: async ({ 
      action, 
      officeId, 
      ...params 
    }: { 
      action: string; 
      officeId: string; 
      [key: string]: any 
    }) => {
      const { data, error } = await supabase.functions.invoke('pms-integrations', {
        body: {
          action,
          officeId,
          ...params,
        },
      });

      if (error) throw error;
      return data;
    },
  });

  // Test PMS integration
  const testPMSMutation = useMutation({
    mutationFn: async (officeId: string) => {
      const { data, error } = await supabase.functions.invoke('pms-test', {
        body: { officeId },
      });

      if (error) throw error;
      return data;
    },
  });

  // Specific PMS operations
  const searchPatientByPhone = (officeId: string, phoneNumber: string) =>
    pmsOperationMutation.mutateAsync({
      action: 'searchPatientByPhone',
      officeId,
      phoneNumber,
    });

  const createPatient = (officeId: string, patientData: any) =>
    pmsOperationMutation.mutateAsync({
      action: 'createPatient',
      officeId,
      patientData,
    });

  const getAvailableSlots = (officeId: string, providerId: string, dateRange: any) =>
    pmsOperationMutation.mutateAsync({
      action: 'getAvailableSlots',
      officeId,
      providerId,
      dateRange,
    });

  const bookAppointment = (officeId: string, appointmentData: any) =>
    pmsOperationMutation.mutateAsync({
      action: 'bookAppointment',
      officeId,
      appointmentData,
    });

  const listProviders = (officeId: string) =>
    pmsOperationMutation.mutateAsync({
      action: 'listProviders',
      officeId,
    });

  const listLocations = (officeId: string) =>
    pmsOperationMutation.mutateAsync({
      action: 'listLocations',
      officeId,
    });

  return {
    // Office management
    offices,
    officesLoading,
    createOffice: createOfficeMutation.mutateAsync,
    updateOffice: updateOfficeMutation.mutateAsync,
    
    // PMS operations
    searchPatientByPhone,
    createPatient,
    getAvailableSlots,
    bookAppointment,
    listProviders,
    listLocations,
    
    // Testing
    testPMS: testPMSMutation.mutateAsync,
    isTestingPMS: testPMSMutation.isPending,
    
    // Loading states
    isLoading: pmsOperationMutation.isPending,
  };
}