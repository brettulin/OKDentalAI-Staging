import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 
      ...corsHeaders,
      "content-type": "application/json" 
    }
  });
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('PMS Test starting...')
    const requestBody = await req.json();
    console.log('Request body:', requestBody)
    
    const { office_id, action } = requestBody;

    if (!office_id) {
      return json({ error: "missing_office_id" }, 400);
    }

    if (!action) {
      return json({ error: "missing_action" }, 400);
    }

    console.log(`Testing office: ${office_id}, action: ${action}`)

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! // must be service key
    );

    console.log('Fetching office from database...')
    const { data: office, error: officeErr } = await supabase
      .from("offices")
      .select("id, pms_type, clinic_id, name")
      .eq("id", office_id)
      .single();
      
    if (officeErr) {
      console.error('Office fetch error:', officeErr)
      return json({ error: "office_fetch_failed", details: officeErr }, 400);
    }

    if (!office) {
      console.error('Office not found')
      return json({ error: "office_not_found", office_id }, 404);
    }

    console.log(`Office found: ${office.name}, PMS type: ${office.pms_type}`)

    // Dummy adapter: return hardcoded successful responses
    if (office.pms_type === "dummy") {
      console.log(`Handling dummy PMS action: ${action}`)
      
      const startTime = Date.now();
      let result;

      try {
        if (action === "ping" || action === "connection") {
          result = { ok: true, system: "dummy", timestamp: new Date().toISOString(), status: "connected" };
        } else if (action === "providers" || action === "listProviders") {
          result = { 
            success: true,
            providers: [
              { id: "prov_1", name: "Dr. Demo Smith", specialty: "General Dentistry" },
              { id: "prov_2", name: "Dr. Jane Doe", specialty: "Orthodontics" },
              { id: "prov_3", name: "Dr. Mike Wilson", specialty: "Oral Surgery" }
            ] 
          };
        } else if (action === "locations" || action === "listLocations") {
          result = { 
            success: true,
            locations: [
              { id: "loc_1", name: "Main Office", address: "123 Main St, City" },
              { id: "loc_2", name: "North Branch", address: "456 North Ave, City" }
            ] 
          };
        } else if (action === "search_patient" || action === "searchPatientByPhone") {
          result = { 
            success: true,
            message: "Patient search functionality available",
            patients: [
              { id: "pat_1", firstName: "Demo", lastName: "Patient", phone: "+1234567890" }
            ]
          };
        } else {
          result = { 
            success: false, 
            error: "unknown_action", 
            action, 
            supported_actions: ["ping", "connection", "providers", "locations", "search_patient"] 
          };
        }

        const endTime = Date.now();
        const latency = endTime - startTime;

        console.log(`Dummy PMS action '${action}' completed in ${latency}ms`)
        
        return json({ 
          success: true,
          data: result,
          latency: `${latency}ms`,
          timestamp: new Date().toISOString(),
          office: { id: office.id, name: office.name, pms_type: office.pms_type }
        });
      } catch (dummyError) {
        console.error(`Dummy PMS error for action '${action}':`, dummyError);
        return json({ 
          success: false,
          error: "dummy_processing_failed", 
          action,
          message: String(dummyError),
          timestamp: new Date().toISOString()
        }, 500);
      }
    }

    // For non-dummy, bail for now
    console.log(`Non-dummy PMS type: ${office.pms_type}`)
    return json({ error: "unsupported_pms_type", pms_type: office.pms_type }, 400);
    
  } catch (e) {
    console.error('PMS Test exception:', e)
    return json({ 
      error: "exception", 
      message: String(e), 
      stack: e?.stack,
      timestamp: new Date().toISOString()
    }, 500);
  }
});