import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { officeId, testPhone = "+1234567890" } = await req.json()

    console.log('Starting PMS integration test...')
    
    // Test credentials - replace with real CareStack test credentials
    const testCredentials = {
      clientId: Deno.env.get('CARESTACK_TEST_CLIENT_ID') || 'test_client_id',
      clientSecret: Deno.env.get('CARESTACK_TEST_CLIENT_SECRET') || 'test_client_secret',
      baseUrl: Deno.env.get('CARESTACK_TEST_BASE_URL') || 'https://api-sandbox.carestack.com/v1'
    }

    // Create or update test office
    const { data: office, error: officeError } = await supabaseClient
      .from('offices')
      .upsert({
        id: officeId,
        name: 'Test Office',
        pms_type: 'carestack',
        pms_credentials: testCredentials,
        clinic_id: '00000000-0000-0000-0000-000000000000' // Default test clinic
      })
      .select()
      .single()

    if (officeError) {
      throw new Error(`Office setup failed: ${officeError.message}`)
    }

    // Test sequence
    const results = []

    // 1. List providers
    try {
      const providersResponse = await supabaseClient.functions.invoke('pms-integrations', {
        body: {
          action: 'listProviders',
          officeId: office.id
        }
      })
      results.push({ test: 'listProviders', ...providersResponse })
    } catch (error) {
      results.push({ test: 'listProviders', error: error.message })
    }

    // 2. List locations
    try {
      const locationsResponse = await supabaseClient.functions.invoke('pms-integrations', {
        body: {
          action: 'listLocations',
          officeId: office.id
        }
      })
      results.push({ test: 'listLocations', ...locationsResponse })
    } catch (error) {
      results.push({ test: 'listLocations', error: error.message })
    }

    // 3. Search for existing patient
    try {
      const searchResponse = await supabaseClient.functions.invoke('pms-integrations', {
        body: {
          action: 'searchPatientByPhone',
          phoneNumber: testPhone,
          officeId: office.id
        }
      })
      results.push({ test: 'searchPatientByPhone', ...searchResponse })
    } catch (error) {
      results.push({ test: 'searchPatientByPhone', error: error.message })
    }

    // 4. Create patient if not found
    try {
      const createResponse = await supabaseClient.functions.invoke('pms-integrations', {
        body: {
          action: 'createPatient',
          patientData: {
            firstName: 'Test',
            lastName: 'Patient',
            phone: testPhone,
            email: 'test@example.com',
            dateOfBirth: '1990-01-01'
          },
          officeId: office.id
        }
      })
      results.push({ test: 'createPatient', ...createResponse })
    } catch (error) {
      results.push({ test: 'createPatient', error: error.message })
    }

    // 5. Get available slots (if we have providers)
    const providersResult = results.find(r => r.test === 'listProviders')
    if (providersResult?.data?.data?.[0]) {
      try {
        const providerId = providersResult.data.data[0].id
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        const dayAfter = new Date()
        dayAfter.setDate(dayAfter.getDate() + 2)

        const slotsResponse = await supabaseClient.functions.invoke('pms-integrations', {
          body: {
            action: 'getAvailableSlots',
            providerId,
            dateRange: {
              from: tomorrow.toISOString().split('T')[0],
              to: dayAfter.toISOString().split('T')[0]
            },
            officeId: office.id
          }
        })
        results.push({ test: 'getAvailableSlots', ...slotsResponse })
      } catch (error) {
        results.push({ test: 'getAvailableSlots', error: error.message })
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        office: office,
        testResults: results,
        summary: {
          total: results.length,
          passed: results.filter(r => !r.error).length,
          failed: results.filter(r => r.error).length
        }
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        } 
      }
    )

  } catch (error) {
    console.error('PMS Test Error:', error)
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