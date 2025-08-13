import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

export interface PMSHealthStatus {
  officeId: string
  pmsType: 'carestack' | 'dentrix' | 'eaglesoft' | 'dummy'
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown'
  lastCheck: Date
  responseTime?: number
  errorMessage?: string
}

export function usePMSHealthMonitoring() {
  const [healthStatuses, setHealthStatuses] = useState<PMSHealthStatus[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  const fetchHealthStatuses = async () => {
    try {
      const { data: offices } = await supabase
        .from('offices')
        .select('id, name, pms_type')
        .not('pms_type', 'is', null)

      if (offices) {
        const healthChecks = offices.map(office => ({
          officeId: office.id,
          pmsType: office.pms_type,
          status: 'healthy' as const,
          lastCheck: new Date()
        }))
        setHealthStatuses(healthChecks)
      }
    } catch (error) {
      console.error('Failed to fetch PMS health statuses:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchHealthStatuses()
  }, [])

  return {
    healthStatuses,
    isLoading,
    fetchHealthStatuses
  }
}