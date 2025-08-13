import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { encryptData, decryptData } from '@/utils/encryption';
import { useCredentialSecurity } from '@/hooks/useCredentialSecurity';
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
  const { requestCredentialAccess, validateCredentialAccess, monitorCredentialAccess } = useCredentialSecurity();

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

  // Create or update office with secure encryption
  const createOfficeMutation = useMutation({
    mutationFn: async (officeData: any) => {
      // Use secure server-side encryption for credentials
      let officeToCreate = { ...officeData };
      
      if (officeData.credentials) {
        const officeId = crypto.randomUUID();
        const { error: encryptError } = await supabase.functions.invoke('secure-pms-handler', {
          body: {
            action: 'encrypt_credentials',
            officeId,
            credentials: officeData.credentials
          }
        });

        if (encryptError) throw encryptError;
        
        // Remove credentials from direct insert since edge function handles encryption
        officeToCreate = {
          ...officeData,
          id: officeId,
          credentials: undefined,
          pms_credentials: undefined
        };
      }

      // Clean up any existing duplicate records first
      const { data: existing } = await supabase
        .from('offices')
        .select('id')
        .eq('clinic_id', officeToCreate.clinic_id!)
        .eq('name', officeToCreate.name);

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
        .upsert(officeToCreate, {
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
    mutationFn: async ({ id, ...updates }: any) => {
      // Use secure server-side encryption for credentials
      let updatesToApply = { ...updates };
      
      if (updates.credentials) {
        const { error: encryptError } = await supabase.functions.invoke('secure-pms-handler', {
          body: {
            action: 'encrypt_credentials',
            officeId: id,
            credentials: updates.credentials
          }
        });

        if (encryptError) throw encryptError;
        
        // Remove credentials from direct update since edge function handles it
        updatesToApply = {
          ...updates,
          credentials: undefined,
          pms_credentials: undefined
        };
      }

      const { data, error } = await supabase
        .from('offices')
        .update(updatesToApply)
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

  // PMS operations with secure credential handling
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
      // Enhanced credential access control with database validation
      if (officeId) {
        // Use comprehensive access validation
        const accessGranted = await requestCredentialAccess({
          officeId,
          purpose: `PMS operation: ${action}`,
          metadata: { 
            action, 
            timestamp: new Date().toISOString(),
            risk_level: action.includes('delete') || action.includes('export') ? 'critical' : 'normal'
          }
        });

        if (!accessGranted) {
          throw new Error('Enhanced credential access denied for PMS operation');
        }

        // Monitor credential access patterns with enhanced detection
        await monitorCredentialAccess(officeId);
      }

      // For PMS operations that need credentials, decrypt them securely
      let enhancedParams = params;
      if (officeId) {
        const { data: credentialsData, error: credentialsError } = await supabase.functions.invoke('secure-pms-handler', {
          body: {
            action: 'decrypt_credentials',
            officeId
          }
        });

        if (!credentialsError && credentialsData?.credentials) {
          enhancedParams = {
            ...params,
            credentials: credentialsData.credentials
          };
        }
      }

      const { data, error } = await supabase.functions.invoke('pms-integrations', {
        body: {
          action,
          officeId,
          ...enhancedParams,
        },
      });

      if (error) {
        console.error(`PMS ${action} error:`, error);
        throw error;
      }
      
      if (!data?.success) {
        console.error(`PMS ${action} failed:`, data);
        throw new Error(data?.error || `${action} operation failed`);
      }
      
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