import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { type, payload } = await req.json();

    console.log(`[AI Call Handler] Received: ${type}`, payload);

    // Get user from auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Authentication failed');
    }

    // Get user's clinic
    const { data: profile } = await supabase
      .from('profiles')
      .select('clinic_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.clinic_id) {
      throw new Error('No clinic found for user');
    }

    switch (type) {
      case 'simulate_call': {
        const { scenario = 'appointment_request' } = payload;
        
        // Create a new call record
        const { data: callData, error: callError } = await supabase
          .from('calls')
          .insert({
            clinic_id: profile.clinic_id,
            outcome: 'simulation_' + scenario,
            transcript_json: {
              scenario,
              simulated: true,
              timestamp: new Date().toISOString()
            }
          })
          .select()
          .single();

        if (callError) {
          throw new Error(`Failed to create call: ${callError.message}`);
        }

        // Create conversation turns based on scenario
        const turns = [];
        
        if (scenario === 'appointment_request') {
          turns.push(
            {
              call_id: callData.id,
              role: 'user',
              text: 'Hi, I would like to schedule an appointment for a cleaning.',
              meta: { simulated: true }
            },
            {
              call_id: callData.id,
              role: 'assistant',
              text: 'I\'d be happy to help you schedule a cleaning appointment. What day works best for you?',
              meta: { simulated: true }
            },
            {
              call_id: callData.id,
              role: 'user',
              text: 'How about next Tuesday morning?',
              meta: { simulated: true }
            },
            {
              call_id: callData.id,
              role: 'assistant',
              text: 'Let me check our availability for Tuesday morning. I have an opening at 10 AM with Dr. Johnson. Would that work for you?',
              meta: { simulated: true }
            },
            {
              call_id: callData.id,
              role: 'user',
              text: 'Perfect, that sounds great. Can you book that for me?',
              meta: { simulated: true }
            },
            {
              call_id: callData.id,
              role: 'assistant',
              text: 'Absolutely! I\'ve scheduled your cleaning appointment for Tuesday at 10 AM with Dr. Johnson. You should receive a confirmation shortly.',
              meta: { simulated: true, action: 'appointment_booked' }
            }
          );
        } else if (scenario === 'information_request') {
          turns.push(
            {
              call_id: callData.id,
              role: 'user',
              text: 'What are your office hours?',
              meta: { simulated: true }
            },
            {
              call_id: callData.id,
              role: 'assistant', 
              text: 'Our office hours are Monday through Friday from 8 AM to 6 PM, and Saturday from 9 AM to 2 PM. We\'re closed on Sundays.',
              meta: { simulated: true }
            },
            {
              call_id: callData.id,
              role: 'user',
              text: 'Do you accept my insurance?',
              meta: { simulated: true }
            },
            {
              call_id: callData.id,
              role: 'assistant',
              text: 'We accept most major insurance plans including BlueCross BlueShield, Aetna, and others. What insurance do you have?',
              meta: { simulated: true }
            }
          );
        } else if (scenario === 'emergency') {
          turns.push(
            {
              call_id: callData.id,
              role: 'user',
              text: 'I have a dental emergency! I\'m in severe pain.',
              meta: { simulated: true }
            },
            {
              call_id: callData.id,
              role: 'assistant',
              text: 'I understand you\'re in pain and I want to help you right away. Let me see what emergency appointments we have available today.',
              meta: { simulated: true }
            },
            {
              call_id: callData.id,
              role: 'assistant',
              text: 'I can get you in with Dr. Chen at 2 PM today for an emergency consultation. Would you be able to come in then?',
              meta: { simulated: true, action: 'emergency_appointment_offered' }
            }
          );
        }

        // Insert turns
        if (turns.length > 0) {
          const { error: turnsError } = await supabase
            .from('turns')
            .insert(turns);

          if (turnsError) {
            console.error('Failed to create turns:', turnsError);
          }
        }

        // Update call with end time
        await supabase
          .from('calls')
          .update({ 
            ended_at: new Date().toISOString(),
            outcome: scenario === 'appointment_request' ? 'appointment_booked' : 
                    scenario === 'emergency' ? 'emergency_scheduled' : 'information_provided'
          })
          .eq('id', callData.id);

        // Log to audit
        await supabase
          .from('audit_log')
          .insert({
            action: 'simulate_call',
            actor: user.email || 'system',
            entity: 'call',
            entity_id: callData.id,
            clinic_id: profile.clinic_id,
            diff_json: { scenario, turns_count: turns.length }
          });

        return new Response(JSON.stringify({
          success: true,
          call_id: callData.id,
          scenario,
          turns_created: turns.length
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_calls': {
        const { limit = 10 } = payload;

        const { data: calls, error } = await supabase
          .from('calls')
          .select(`
            *,
            turns(count)
          `)
          .eq('clinic_id', profile.clinic_id)
          .order('started_at', { ascending: false })
          .limit(limit);

        if (error) {
          throw new Error(`Failed to get calls: ${error.message}`);
        }

        return new Response(JSON.stringify({
          success: true,
          calls
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_call_details': {
        const { call_id } = payload;

        const { data: callData, error: callError } = await supabase
          .from('calls')
          .select(`
            *,
            turns(*)
          `)
          .eq('id', call_id)
          .eq('clinic_id', profile.clinic_id)
          .single();

        if (callError) {
          throw new Error(`Failed to get call details: ${callError.message}`);
        }

        return new Response(JSON.stringify({
          success: true,
          call: callData
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        throw new Error(`Unknown type: ${type}`);
    }

  } catch (error) {
    console.error('Error in ai-call-handler:', error);
    
    // Log error to audit if possible
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      await supabase
        .from('audit_log')
        .insert({
          action: 'edge_function_error',
          actor: 'system',
          entity: 'ai_call_handler',
          diff_json: {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack?.substring(0, 2000) : undefined
          }
        });
    } catch (auditError) {
      console.error('Failed to log error to audit:', auditError);
    }

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});