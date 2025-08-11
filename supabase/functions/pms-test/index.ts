import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function to return JSON responses
const json = (data: any, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: { 
          headers: { 
            Authorization: req.headers.get('Authorization') ?? '' 
          } 
        }
      }
    )

    const { office_id, action } = await req.json()

    console.log(`Starting PMS test for office: ${office_id}, action: ${action}`)
    
    // Get office configuration
    const { data: office, error: officeError } = await supabaseClient
      .from('offices')
      .select('*')
      .eq('id', office_id)
      .maybeSingle()

    if (officeError) {
      console.error('Office fetch error:', officeError)
      return json({ error: `Failed to fetch office: ${officeError.message}` }, 400)
    }

    if (!office) {
      return json({ error: 'Office not found' }, 404)
    }

    console.log(`Office found: ${office.name}, PMS type: ${office.pms_type}`)

    // Handle dummy PMS with mock data
    if (office.pms_type === 'dummy') {
      const startTime = Date.now()
      
      let result
      switch (action) {
        case 'ping':
        case 'connection':
          result = { 
            ok: true, 
            system: 'dummy',
            message: 'Dummy PMS connection successful',
            timestamp: new Date().toISOString()
          }
          break
          
        case 'providers':
        case 'listProviders':
          result = { 
            providers: [
              { id: 'prov_1', name: 'Dr. Demo Smith', speciality: 'General Dentistry' },
              { id: 'prov_2', name: 'Dr. Jane Doe', speciality: 'Orthodontics' },
              { id: 'prov_3', name: 'Dr. John Wilson', speciality: 'Oral Surgery' }
            ]
          }
          break
          
        case 'locations':
        case 'listLocations':
          result = { 
            locations: [
              { id: 'loc_1', name: 'Main Office', address: '123 Main St, Demo City' },
              { id: 'loc_2', name: 'North Branch', address: '456 North Ave, Demo City' }
            ]
          }
          break
          
        case 'search_patient':
        case 'searchPatientByPhone':
          result = { 
            message: 'Patient search functionality available',
            patients: [
              { 
                id: 'pat_1', 
                firstName: 'Demo', 
                lastName: 'Patient',
                phone: '+1234567890',
                email: 'demo@example.com'
              }
            ]
          }
          break
          
        default:
          return json({ error: `Unknown action: ${action}` }, 400)
      }

      const endTime = Date.now()
      const latency = endTime - startTime

      return json({ 
        success: true, 
        data: result,
        latency: `${latency}ms`,
        timestamp: new Date().toISOString()
      })
    }

    // For non-dummy PMS types, call the actual integration
    const integrationResponse = await supabaseClient.functions.invoke('pms-integrations', {
      body: {
        action: action === 'ping' ? 'listProviders' : action, // Convert ping to a real action
        officeId: office_id
      }
    })

    if (integrationResponse.error) {
      return json({ 
        error: `Integration failed: ${integrationResponse.error.message}`,
        details: integrationResponse.error
      }, 400)
    }

    return json({
      success: true,
      data: integrationResponse.data,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('PMS Test Error:', error)
    return json({ 
      error: String(error), 
      stack: error?.stack 
    }, 400)
  }
})