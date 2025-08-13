import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from './useAuth'

interface ProcedureCodesParams {
  officeId: string
  code?: string
  offset?: number
  limit?: number
}

interface AppointmentProceduresParams {
  officeId: string
  appointmentId: string
}

export function useCareStackProcedures() {
  const { user } = useAuth()

  const getProcedureCodes = (params: ProcedureCodesParams) => {
    return useQuery({
      queryKey: ['carestack-procedure-codes', params],
      queryFn: async () => {
        const url = new URL('https://zvpezltqpphvolzgfhme.supabase.co/functions/v1/carestack-procedures-treatments')
        url.searchParams.set('officeId', params.officeId)
        url.searchParams.set('action', 'procedure-codes')
        if (params.code) url.searchParams.set('code', params.code)
        if (params.offset) url.searchParams.set('offset', params.offset.toString())
        if (params.limit) url.searchParams.set('limit', params.limit.toString())

        const { data, error } = await supabase.functions.invoke('carestack-procedures-treatments', {
          body: {
            officeId: params.officeId,
            action: 'procedure-codes',
            code: params.code,
            offset: params.offset,
            limit: params.limit
          }
        })
        
        if (error) throw error
        return data
      },
      enabled: !!user && !!params.officeId
    })
  }

  const getProductionTypes = (officeId: string) => {
    return useQuery({
      queryKey: ['carestack-production-types', officeId],
      queryFn: async () => {
        const { data, error } = await supabase.functions.invoke('carestack-procedures-treatments', {
          body: {
            officeId,
            action: 'production-types'
          }
        })
        
        if (error) throw error
        return data
      },
      enabled: !!user && !!officeId
    })
  }

  const getAppointmentProcedures = (params: AppointmentProceduresParams) => {
    return useQuery({
      queryKey: ['carestack-appointment-procedures', params],
      queryFn: async () => {
        const { data, error } = await supabase.functions.invoke('carestack-procedures-treatments', {
          body: {
            officeId: params.officeId,
            action: 'appointment-procedures',
            appointmentId: params.appointmentId
          }
        })
        
        if (error) throw error
        return data
      },
      enabled: !!user && !!params.officeId && !!params.appointmentId
    })
  }

  return {
    getProcedureCodes,
    getProductionTypes,
    getAppointmentProcedures
  }
}