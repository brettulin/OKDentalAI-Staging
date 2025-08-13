import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getAuthContext } from '../_shared/auth.ts'
import { CareStackAdapter } from '../_shared/carestack-adapter.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authContext = await getAuthContext(req)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const url = new URL(req.url)
    const officeId = url.searchParams.get('officeId')
    const action = url.searchParams.get('action') // 'procedure-codes', 'production-types', 'appointment-procedures', 'sync-treatments'

    if (!officeId || !action) {
      return new Response(
        JSON.stringify({ error: 'Office ID and action are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get office details
    const { data: office, error: officeError } = await supabase
      .from('offices')
      .select('*')
      .eq('id', officeId)
      .eq('clinic_id', authContext.clinic_id)
      .single()

    if (officeError || !office) {
      return new Response(
        JSON.stringify({ error: 'Office not found or access denied' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (office.pms_type !== 'carestack') {
      return new Response(
        JSON.stringify({ error: 'Office is not configured for CareStack' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Initialize CareStack adapter
    const adapter = new CareStackAdapter({
      vendorKey: office.credentials?.vendorKey || '',
      accountKey: office.credentials?.accountKey || '',
      accountId: office.credentials?.accountId || '',
      baseUrl: office.credentials?.baseUrl,
      useMockMode: office.use_mock_mode ?? true
    })

    let result: any = null

    switch (action) {
      case 'procedure-codes':
        const code = url.searchParams.get('code')
        const offset = parseInt(url.searchParams.get('offset') || '0')
        const limit = parseInt(url.searchParams.get('limit') || '20')
        result = await adapter.getProcedureCodes(code || undefined, offset, limit)
        break

      case 'production-types':
        result = await adapter.getProductionTypes()
        break

      case 'appointment-procedures':
        const appointmentId = url.searchParams.get('appointmentId')
        if (!appointmentId) {
          return new Response(
            JSON.stringify({ error: 'Appointment ID is required for appointment-procedures action' }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          )
        }
        result = await adapter.getAppointmentProcedures(parseInt(appointmentId))
        break

      case 'sync-treatments':
        const modifiedSince = url.searchParams.get('modifiedSince')
        const continueToken = url.searchParams.get('continueToken')
        const includeDeleted = url.searchParams.get('includeDeleted') === 'true'
        
        if (!modifiedSince) {
          return new Response(
            JSON.stringify({ error: 'modifiedSince parameter is required for sync-treatments action' }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          )
        }

        result = await adapter.syncTreatmentProcedures(
          modifiedSince, 
          continueToken || undefined, 
          includeDeleted
        )
        break

      case 'appointment-statuses':
        result = await adapter.getAppointmentStatuses()
        break

      default:
        return new Response(
          JSON.stringify({ 
            error: 'Invalid action. Supported: procedure-codes, production-types, appointment-procedures, sync-treatments, appointment-statuses' 
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
    }

    // Log the operation
    await supabase.from('audit_log').insert({
      clinic_id: authContext.clinic_id,
      user_id: authContext.user_id,
      action: `carestack_${action.replace('-', '_')}`,
      details: {
        office_id: officeId,
        action: action,
        result_count: Array.isArray(result) ? result.length : 1
      }
    })

    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error accessing procedures/treatments:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to access procedures/treatments',
        message: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})