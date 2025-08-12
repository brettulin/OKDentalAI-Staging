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
    const { officeId, patientData } = body
    
    if (!officeId || !patientData) {
      return new Response(
        JSON.stringify({ error: 'Office ID and patient data are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate required patient fields
    if (!patientData.firstName || !patientData.lastName) {
      return new Response(
        JSON.stringify({ error: 'Patient first name and last name are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
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

    // Create patient in CareStack
    const newPatient = await adapter.createPatient(patientData)

    // Also create/update patient in our local database
    const localPatientData = {
      full_name: `${patientData.firstName} ${patientData.lastName}`,
      phone: patientData.phone || null,
      email: patientData.email || null,
      dob: patientData.dateOfBirth || null,
      clinic_id: authContext.clinic_id,
      office_id: officeId,
      external_id: newPatient.id,
      source: 'carestack'
    }

    const { data: localPatient, error: localError } = await supabase
      .from('patients')
      .upsert(localPatientData, { 
        onConflict: 'external_id,office_id',
        ignoreDuplicates: false 
      })
      .select()
      .single()

    if (localError) {
      console.error('Error creating local patient record:', localError)
      // Continue anyway since CareStack creation succeeded
    }

    // Log the operation
    await supabase.from('audit_log').insert({
      clinic_id: authContext.clinic_id,
      actor: authContext.user.email,
      action: 'pms_create_patient',
      entity: 'carestack_patient',
      entity_id: officeId,
      diff_json: { 
        carestackPatientId: newPatient.id,
        localPatientId: localPatient?.id,
        patientName: `${patientData.firstName} ${patientData.lastName}`
      }
    })

    return new Response(
      JSON.stringify({ 
        success: true, 
        patient: newPatient,
        localPatient: localPatient
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in pms-carestack-create-patient:', error)
    
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