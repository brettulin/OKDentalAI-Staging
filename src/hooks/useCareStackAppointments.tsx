import { useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from './useAuth'
import { toast } from 'sonner'

interface AppointmentActionParams {
  officeId: string
  appointmentId: string
  action: 'get' | 'delete' | 'cancel' | 'checkout' | 'modify-status'
  data?: any
}

export function useCareStackAppointments() {
  const { user } = useAuth()

  const appointmentActionMutation = useMutation({
    mutationFn: async (params: AppointmentActionParams) => {
      const url = new URL('https://zvpezltqpphvolzgfhme.supabase.co/functions/v1/carestack-appointment-management')
      url.searchParams.set('officeId', params.officeId)
      url.searchParams.set('appointmentId', params.appointmentId)
      url.searchParams.set('action', params.action)

      const { data, error } = await supabase.functions.invoke('carestack-appointment-management', {
        body: params.data || {},
        method: params.data ? 'POST' : 'GET'
      })
      
      if (error) throw error
      return data
    },
    onSuccess: (data, variables) => {
      const actionMessages = {
        'get': 'Appointment retrieved successfully',
        'delete': 'Appointment deleted successfully',
        'cancel': 'Appointment cancelled successfully',
        'checkout': 'Appointment checked out successfully',
        'modify-status': 'Appointment status updated successfully'
      }
      toast.success(actionMessages[variables.action] || 'Action completed successfully')
    },
    onError: (error, variables) => {
      console.error('Appointment action error:', error)
      toast.error(`Failed to ${variables.action} appointment`)
    }
  })

  const getAppointmentStatuses = useQuery({
    queryKey: ['carestack-appointment-statuses'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('carestack-procedures-treatments', {
        body: {
          action: 'appointment-statuses'
        }
      })
      
      if (error) throw error
      return data
    },
    enabled: !!user
  })

  return {
    performAppointmentAction: appointmentActionMutation.mutate,
    appointmentStatuses: getAppointmentStatuses.data,
    isLoading: appointmentActionMutation.isPending || getAppointmentStatuses.isLoading
  }
}