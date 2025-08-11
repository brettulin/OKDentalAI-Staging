import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PMSFactory } from './pms/pms-factory.ts'

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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: user } = await supabaseClient.auth.getUser(token)

    if (!user?.user) {
      throw new Error('Unauthorized')
    }

    const { action, officeId, ...payload } = await req.json()

    // Get office configuration
    const { data: office, error: officeError } = await supabaseClient
      .from('offices')
      .select('*')
      .eq('id', officeId)
      .single()

    if (officeError || !office) {
      throw new Error('Office not found')
    }

    // Create PMS adapter instance
    const pmsAdapter = PMSFactory.createAdapter(office.pms_type, office.pms_credentials)

    let result
    switch (action) {
      case 'searchPatientByPhone':
        result = await pmsAdapter.searchPatientByPhone(payload.phoneNumber)
        break
      case 'createPatient':
        result = await pmsAdapter.createPatient(payload.patientData)
        break
      case 'getAvailableSlots':
        result = await pmsAdapter.getAvailableSlots(payload.providerId, payload.dateRange)
        break
      case 'bookAppointment':
        result = await pmsAdapter.bookAppointment(payload.appointmentData)
        break
      case 'listProviders':
        result = await pmsAdapter.listProviders()
        break
      case 'listLocations':
        result = await pmsAdapter.listLocations()
        break
      default:
        throw new Error(`Unknown action: ${action}`)
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        } 
      }
    )

  } catch (error) {
    console.error('PMS Integration Error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 400,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        } 
      }
    )
  }
})