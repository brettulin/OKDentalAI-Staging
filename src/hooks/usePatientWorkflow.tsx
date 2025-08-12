import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePMSIntegration } from './usePMSIntegration';
import { useAuth } from './useAuth';
import { useToast } from '@/components/ui/use-toast';

export interface PatientSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  dateOfBirth?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
}

export interface AppointmentSlot {
  id: string;
  startTime: string;
  endTime: string;
  providerId: string;
  locationId: string;
  available: boolean;
}

export interface BookingData {
  patientId: string;
  providerId: string;
  locationId: string;
  serviceId?: string;
  startTime: string;
  endTime: string;
  notes?: string;
}

export const usePatientWorkflow = (officeId: string) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchResult | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AppointmentSlot | null>(null);
  
  const {
    searchPatientByPhone,
    createPatient,
    getAvailableSlots,
    bookAppointment,
    listProviders,
    listLocations
  } = usePMSIntegration();

  // Search patients by phone number
  const searchPatientsMutation = useMutation({
    mutationFn: async (phoneNumber: string) => {
      if (!phoneNumber.trim()) {
        throw new Error('Phone number is required');
      }
      
      return await searchPatientByPhone(officeId, phoneNumber);
    },
    onError: (error) => {
      toast({
        title: "Search Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Create new patient
  const createPatientMutation = useMutation({
    mutationFn: async (patientData: {
      firstName: string;
      lastName: string;
      phone: string;
      email?: string;
      dateOfBirth?: string;
      address?: {
        street: string;
        city: string;
        state: string;
        zipCode: string;
      };
    }) => {
      // Get current user's clinic_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('clinic_id')
        .eq('user_id', user?.id)
        .single();

      const newPatient = await createPatient(officeId, patientData);
      
      // Also create patient in local database
      const { data, error } = await supabase
        .from('patients')
        .insert({
          clinic_id: profile?.clinic_id,
          full_name: `${patientData.firstName} ${patientData.lastName}`,
          phone: patientData.phone,
          email: patientData.email,
          dob: patientData.dateOfBirth || null,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating local patient record:', error);
        // Don't throw - PMS creation succeeded
      }

      return newPatient;
    },
    onSuccess: (patient) => {
      setSelectedPatient(patient);
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      toast({
        title: "Patient Created",
        description: `Successfully created patient: ${patient.firstName} ${patient.lastName}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Creation Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Get available appointment slots
  const getSlotsMutation = useMutation({
    mutationFn: async (params: {
      providerId: string;
      dateRange: { from: string; to: string };
    }) => {
      return await getAvailableSlots(officeId, params.providerId, params.dateRange);
    },
    onError: (error) => {
      toast({
        title: "Slot Fetch Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Book appointment
  const bookAppointmentMutation = useMutation({
    mutationFn: async (bookingData: BookingData) => {
      if (!selectedPatient) {
        throw new Error('No patient selected');
      }

      // Get current user's clinic_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('clinic_id')
        .eq('user_id', user?.id)
        .single();

      const appointment = await bookAppointment(officeId, bookingData);
      
      // Also create appointment in local database
      const { data, error } = await supabase
        .from('appointments')
        .insert({
          clinic_id: profile?.clinic_id,
          patient_id: selectedPatient.id,
          provider_id: bookingData.providerId,
          location_id: bookingData.locationId,
          service_id: bookingData.serviceId,
          starts_at: bookingData.startTime,
          ends_at: bookingData.endTime,
          source: 'ai_receptionist'
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating local appointment record:', error);
        // Don't throw - PMS booking succeeded
      }

      return appointment;
    },
    onSuccess: (appointment) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast({
        title: "Appointment Booked",
        description: "Successfully booked appointment",
      });
      
      // Reset workflow state
      setSelectedPatient(null);
      setSelectedSlot(null);
    },
    onError: (error) => {
      toast({
        title: "Booking Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Fetch providers
  const { data: providers, isLoading: providersLoading } = useQuery({
    queryKey: ['pms-providers', officeId],
    queryFn: () => listProviders(officeId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch locations
  const { data: locations, isLoading: locationsLoading } = useQuery({
    queryKey: ['pms-locations', officeId],
    queryFn: () => listLocations(officeId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Helper function to format phone number
  const formatPhoneNumber = useCallback((phone: string): string => {
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');
    
    // Format as +1 (XXX) XXX-XXXX for US numbers
    if (digits.length === 10) {
      return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length === 11 && digits.startsWith('1')) {
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    
    return phone; // Return original if format doesn't match
  }, []);

  const searchPatients = useCallback(async (phoneNumber: string) => {
    const formattedPhone = formatPhoneNumber(phoneNumber);
    return searchPatientsMutation.mutateAsync(formattedPhone);
  }, [searchPatientsMutation, formatPhoneNumber]);

  const getAvailableSlotsForDate = useCallback(async (providerId: string, date: string) => {
    const startDate = new Date(date);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 1);
    
    return getSlotsMutation.mutateAsync({
      providerId,
      dateRange: {
        from: startDate.toISOString(),
        to: endDate.toISOString()
      }
    });
  }, [getSlotsMutation]);

  return {
    // State
    selectedPatient,
    selectedSlot,
    setSelectedPatient,
    setSelectedSlot,
    
    // Data
    providers,
    locations,
    
    // Actions
    searchPatients,
    createPatient: createPatientMutation.mutateAsync,
    getAvailableSlotsForDate,
    bookAppointment: bookAppointmentMutation.mutateAsync,
    
    // Loading states
    isSearching: searchPatientsMutation.isPending,
    isCreatingPatient: createPatientMutation.isPending,
    isGettingSlots: getSlotsMutation.isPending,
    isBooking: bookAppointmentMutation.isPending,
    providersLoading,
    locationsLoading,
    
    // Utilities
    formatPhoneNumber,
  };
};