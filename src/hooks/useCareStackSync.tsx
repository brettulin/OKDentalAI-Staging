import { useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from './useAuth'
import { toast } from 'sonner'

interface SyncPatientsParams {
  officeId: string
  modifiedSince: string
  continueToken?: string
}

interface SyncAppointmentsParams {
  officeId: string
  modifiedSince: string
  continueToken?: string
}

interface SyncTreatmentsParams {
  officeId: string
  modifiedSince: string
  continueToken?: string
  includeDeleted?: boolean
}

export function useCareStackSync() {
  const { user } = useAuth()

  const syncPatientsMutation = useMutation({
    mutationFn: async (params: SyncPatientsParams) => {
      const { data, error } = await supabase.functions.invoke('carestack-sync-patients', {
        body: params
      })
      
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      toast.success(`Synced ${data.items.length} patients${data.hasMore ? ' (more available)' : ''}`)
    },
    onError: (error) => {
      console.error('Patient sync error:', error)
      toast.error('Failed to sync patients')
    }
  })

  const syncAppointmentsMutation = useMutation({
    mutationFn: async (params: SyncAppointmentsParams) => {
      const { data, error } = await supabase.functions.invoke('carestack-sync-appointments', {
        body: params
      })
      
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      toast.success(`Synced ${data.items.length} appointments${data.hasMore ? ' (more available)' : ''}`)
    },
    onError: (error) => {
      console.error('Appointment sync error:', error)
      toast.error('Failed to sync appointments')
    }
  })

  const syncTreatmentsMutation = useMutation({
    mutationFn: async (params: SyncTreatmentsParams) => {
      const { data, error } = await supabase.functions.invoke('carestack-procedures-treatments', {
        body: {
          officeId: params.officeId,
          action: 'sync-treatments',
          modifiedSince: params.modifiedSince,
          continueToken: params.continueToken,
          includeDeleted: params.includeDeleted
        }
      })
      
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      toast.success(`Synced ${data.items.length} treatments${data.hasMore ? ' (more available)' : ''}`)
    },
    onError: (error) => {
      console.error('Treatment sync error:', error)
      toast.error('Failed to sync treatments')
    }
  })

  return {
    syncPatients: syncPatientsMutation.mutate,
    syncAppointments: syncAppointmentsMutation.mutate,
    syncTreatments: syncTreatmentsMutation.mutate,
    isLoading: syncPatientsMutation.isPending || 
               syncAppointmentsMutation.isPending || 
               syncTreatmentsMutation.isPending
  }
}