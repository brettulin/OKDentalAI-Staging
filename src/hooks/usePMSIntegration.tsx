import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
  const { data: offices, isLoading: officesLoading } = useQuery({
    queryKey: ['offices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('offices')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as OfficeRow[];
    },
  });

  // Create or update office
  const createOfficeMutation = useMutation({
    mutationFn: async (officeData: OfficeInsert) => {
      const { data, error } = await supabase
        .from('offices')
        .insert(officeData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offices'] });
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