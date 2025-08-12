import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
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
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get authentication context
    const authContext = await getAuthContext(req)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get parameters from request
    const url = new URL(req.url)
    const officeId = url.searchParams.get('officeId')
    const query = url.searchParams.get('q') || ''
    const phone = url.searchParams.get('phone') || ''
    const email = url.searchParams.get('email') || ''
    const dob = url.searchParams.get('dob') || ''
    const page = parseInt(url.searchParams.get('page') || '1')
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20')
    
    if (!officeId) {
      return new Response(
        JSON.stringify({ error: 'Office ID is required' }),
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

    // Search patients
    const searchRequest = {
      q: query || undefined,
      phone: phone || undefined,
      email: email || undefined,
      dob: dob || undefined,
      page,
      pageSize
    }

    const result = await adapter.searchPatients(searchRequest)

    // Log the operation
    await supabase.from('audit_log').insert({
      clinic_id: authContext.clinic_id,
      actor: authContext.user.email,
      action: 'pms_search_patients',
      entity: 'carestack_patients',
      entity_id: officeId,
      diff_json: { 
        searchParams: searchRequest,
        resultCount: result.total 
      }
    })

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in pms-carestack-search-patients:', error)
    
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