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
    const appointmentId = url.searchParams.get('appointmentId')
    const action = url.searchParams.get('action') // 'get', 'delete', 'cancel', 'checkout', 'modify-status'

    if (!officeId || !appointmentId || !action) {
      return new Response(
        JSON.stringify({ error: 'Office ID, appointment ID, and action are required' }),
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

    const apptId = parseInt(appointmentId)
    let result: any = null

    switch (action) {
      case 'get':
        result = await adapter.getAppointment(apptId)
        break

      case 'delete':
        result = { success: await adapter.deleteAppointment(apptId) }
        break

      case 'cancel':
        const reason = url.searchParams.get('reason') || 'Cancelled by user'
        if (req.method === 'POST') {
          // Enhanced cancel with details
          const body = await req.json()
          result = { success: await adapter.cancelAppointmentWithDetails(apptId, body) }
        } else {
          // Simple cancel
          result = { success: await adapter.cancelAppointment(apptId, reason) }
        }
        break

      case 'checkout':
        const overrideValidation = url.searchParams.get('overrideCareNoteValidation') !== 'false'
        result = { success: await adapter.checkoutAppointment(apptId, overrideValidation) }
        break

      case 'modify-status':
        if (req.method !== 'POST') {
          return new Response(
            JSON.stringify({ error: 'POST method required for status modification' }),
            { 
              status: 405, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          )
        }
        const statusData = await req.json()
        result = { success: await adapter.modifyAppointmentStatus(apptId, statusData) }
        break

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action. Supported: get, delete, cancel, checkout, modify-status' }),
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
      action: `carestack_appointment_${action}`,
      details: {
        office_id: officeId,
        appointment_id: appointmentId,
        result: result
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
    console.error('Error managing appointment:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to manage appointment',
        message: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})