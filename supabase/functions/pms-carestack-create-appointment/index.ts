import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getAuthContext } from '../_shared/auth.ts'
import { CareStackAdapter } from '../pms-integrations/carestack-adapter.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }

  try {
    // Get authentication context
    const authContext = await getAuthContext(req)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Parse request body
    const body = await req.json()
    const { officeId, appointmentData } = body
    
    if (!officeId || !appointmentData) {
      return new Response(
        JSON.stringify({ error: 'Office ID and appointment data are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate required appointment fields
    const required = ['patientId', 'providerId', 'locationId', 'startTime', 'endTime']
    for (const field of required) {
      if (!appointmentData[field]) {
        return new Response(
          JSON.stringify({ error: `${field} is required` }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
    }

    // Fetch office configuration with clinic scoping
    const { data: office, error: officeError } = await supabase
      .from('offices')
      .select('*')
      .eq('id', officeId)
      .eq('clinic_id', authContext.clinic_id)
      .single()

    if (officeError || !office) {
      console.error('Office not found:', officeError)
      return new Response(
        JSON.stringify({ error: 'Office not found or access denied' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Verify PMS type
    if (office.pms_type !== 'carestack') {
      return new Response(
        JSON.stringify({ error: 'Office is not configured for CareStack' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Create CareStack adapter
    const adapter = new CareStackAdapter({
      ...office.pms_credentials,
      useMockMode: Deno.env.get('CARESTACK_USE_MOCK') === 'true'
    })

    // Create appointment in CareStack
    const newAppointment = await adapter.bookAppointment(appointmentData)

    // Find local patient by external_id (CareStack patient ID)
    const { data: localPatient } = await supabase
      .from('patients')
      .select('id')
      .eq('external_id', appointmentData.patientId)
      .eq('office_id', officeId)
      .single()

    // Create appointment in our local database
    const localAppointmentData = {
      patient_id: localPatient?.id || null,
      provider_id: appointmentData.providerId, // This might need mapping
      location_id: appointmentData.locationId, // This might need mapping
      service_id: appointmentData.serviceId || null,
      starts_at: appointmentData.startTime,
      ends_at: appointmentData.endTime,
      clinic_id: authContext.clinic_id,
      office_id: officeId,
      external_id: newAppointment.id,
      source: 'carestack'
    }

    const { data: localAppointment, error: localError } = await supabase
      .from('appointments')
      .insert(localAppointmentData)
      .select()
      .single()

    if (localError) {
      console.error('Error creating local appointment record:', localError)
      // Continue anyway since CareStack creation succeeded
    }

    // Update slot status if it exists
    if (appointmentData.slotId) {
      await supabase
        .from('slots')
        .update({ status: 'booked' })
        .eq('id', appointmentData.slotId)
    }

    // Log the operation
    await supabase.from('audit_log').insert({
      clinic_id: authContext.clinic_id,
      actor: authContext.user.email,
      action: 'pms_create_appointment',
      entity: 'carestack_appointment',
      entity_id: officeId,
      diff_json: { 
        carestackAppointmentId: newAppointment.id,
        localAppointmentId: localAppointment?.id,
        patientId: appointmentData.patientId,
        startTime: appointmentData.startTime
      }
    })

    return new Response(
      JSON.stringify({ 
        success: true, 
        appointment: newAppointment,
        localAppointment: localAppointment
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in pms-carestack-create-appointment:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})