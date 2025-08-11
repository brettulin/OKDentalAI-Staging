import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PMSFactory } from './pms/pms-factory.ts'
import { getAuthContext } from '../_shared/auth.ts'

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
    const authContext = await getAuthContext(req);
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { action, officeId, ...payload } = await req.json();

    console.log(`PMS Integration: ${action} for office ${officeId}, clinic ${authContext.clinic_id}`);

    // Get office configuration
    const { data: office, error: officeError } = await supabase
      .from('offices')
      .select('*')
      .eq('id', officeId)
      .eq('clinic_id', authContext.clinic_id) // Enforce tenant scoping
      .maybeSingle();

    if (officeError) {
      console.error('Office fetch error:', officeError);
      throw new Error(`Failed to fetch office: ${officeError.message}`);
    }

    if (!office) {
      throw new Error('Office not found or access denied');
    }

    // Create PMS adapter instance
    const pmsAdapter = PMSFactory.createAdapter(office.pms_type, office.pms_credentials);

    let result;
    const startTime = Date.now();

    try {
      switch (action) {
        case 'searchPatientByPhone':
          result = await pmsAdapter.searchPatientByPhone(payload.phoneNumber);
          break;
        case 'createPatient':
          result = await pmsAdapter.createPatient(payload.patientData);
          break;
        case 'getAvailableSlots':
          result = await pmsAdapter.getAvailableSlots(payload.providerId, payload.dateRange);
          break;
        case 'bookAppointment':
          result = await pmsAdapter.bookAppointment(payload.appointmentData);
          break;
        case 'listProviders':
          result = await pmsAdapter.listProviders();
          break;
        case 'listLocations':
          result = await pmsAdapter.listLocations();
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      const duration = Date.now() - startTime;

      // Write audit log for successful operations
      await supabase
        .from('audit_log')
        .insert({
          clinic_id: authContext.clinic_id,
          entity: 'pms',
          entity_id: office.id,
          action: `pms.${action}`,
          actor: authContext.user.email || 'system',
          diff_json: { 
            action, 
            duration_ms: duration,
            result_count: Array.isArray(result) ? result.length : result ? 1 : 0
          }
        });

      return new Response(
        JSON.stringify({ 
          success: true, 
          data: result,
          meta: {
            duration_ms: duration,
            office_id: office.id,
            pms_type: office.pms_type
          }
        }),
        { 
          headers: { 
            ...corsHeaders,
            'Content-Type': 'application/json'
          } 
        }
      );

    } catch (pmsError) {
      const duration = Date.now() - startTime;
      console.error(`PMS ${action} error:`, pmsError);

      // Write audit log for failed operations
      await supabase
        .from('audit_log')
        .insert({
          clinic_id: authContext.clinic_id,
          entity: 'pms',
          entity_id: office.id,
          action: `pms.${action}.failed`,
          actor: authContext.user.email || 'system',
          diff_json: { 
            action, 
            duration_ms: duration,
            error: pmsError.message
          }
        });

      throw pmsError;
    }

  } catch (error) {
    console.error('PMS Integration Error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: error.message.includes('Authentication') ? 401 : 400,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        } 
      }
    );
  }
});