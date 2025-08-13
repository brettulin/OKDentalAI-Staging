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
    const modifiedSince = url.searchParams.get('modifiedSince')
    const continueToken = url.searchParams.get('continueToken')

    if (!officeId) {
      return new Response(
        JSON.stringify({ error: 'Office ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!modifiedSince) {
      return new Response(
        JSON.stringify({ error: 'modifiedSince parameter is required (ISO date string)' }),
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

    // Sync patients
    const syncResult = await adapter.syncPatients(modifiedSince, continueToken || undefined)

    // Log the sync operation
    await supabase.from('audit_log').insert({
      clinic_id: authContext.clinic_id,
      user_id: authContext.user_id,
      action: 'carestack_sync_patients',
      details: {
        office_id: officeId,
        modified_since: modifiedSince,
        patient_count: syncResult.items.length,
        has_more: syncResult.hasMore,
        continue_token: syncResult.continueToken
      }
    })

    return new Response(
      JSON.stringify(syncResult),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error syncing patients:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to sync patients',
        message: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})