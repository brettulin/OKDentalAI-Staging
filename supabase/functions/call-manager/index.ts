import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getAuthContext } from '../_shared/auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ALLOWED_OUTCOMES = [
  'appointment_booked',
  'transferred', 
  'voicemail',
  'no_answer',
  'cancelled', 
  'completed',
  'failed'
] as const;

type CallOutcome = typeof ALLOWED_OUTCOMES[number];

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

    const requestBody = await req.json();
    const { action } = requestBody;

    console.log(`Call Manager: ${action} for clinic ${authContext.clinic_id}`);

    switch (action) {
      case 'start_call': {
        const { callId, officeId, twilioCallSid, fromNumber, toNumber } = requestBody;
        
        const callData = {
          id: callId,
          clinic_id: authContext.clinic_id,
          office_id: officeId || null,
          twilio_call_sid: twilioCallSid || null,
          started_at: new Date().toISOString(),
          transcript_json: { 
            from_number: fromNumber,
            to_number: toNumber,
            call_type: 'simulation'
          }
        };

        const { data: call, error } = await supabase
          .from('calls')
          .insert(callData)
          .select()
          .single();

        if (error) throw error;

        // Initial AI greeting
        const { error: turnError } = await supabase
          .from('turns')
          .insert({
            call_id: callId,
            role: 'assistant',
            text: 'Hello! Thank you for calling our dental office. How can I help you today?',
            at: new Date().toISOString(),
            meta: { initial_greeting: true }
          });

        if (turnError) {
          console.error('Initial turn creation error:', turnError);
        }

        // Write audit log
        await supabase
          .from('audit_log')
          .insert({
            clinic_id: authContext.clinic_id,
            entity: 'call',
            entity_id: callId,
            action: 'call.started',
            actor: authContext.user.email || 'system',
            diff_json: { from_number: fromNumber, to_number: toNumber }
          });

        return new Response(
          JSON.stringify({
            success: true,
            call,
            initialResponse: 'Hello! Thank you for calling our dental office. How can I help you today?'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'end_call': {
        const { callId, outcome } = requestBody;
        
        // Validate outcome
        const validOutcome = outcome && ALLOWED_OUTCOMES.includes(outcome) ? outcome : 'completed';
        
        const { data: call, error } = await supabase
          .from('calls')
          .update({
            ended_at: new Date().toISOString(),
            outcome: validOutcome
          })
          .eq('id', callId)
          .eq('clinic_id', authContext.clinic_id)
          .select()
          .single();

        if (error) throw error;

        // Write audit log
        await supabase
          .from('audit_log')
          .insert({
            clinic_id: authContext.clinic_id,
            entity: 'call',
            entity_id: callId,
            action: 'call.ended',
            actor: authContext.user.email || 'system',
            diff_json: { outcome: validOutcome }
          });

        return new Response(
          JSON.stringify({ success: true, call }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update_call_outcome': {
        const { callId, outcome, transcriptJson } = requestBody;
        
        const updateData: any = {};
        
        if (outcome && ALLOWED_OUTCOMES.includes(outcome)) {
          updateData.outcome = outcome;
        }
        
        if (transcriptJson) {
          updateData.transcript_json = transcriptJson;
        }

        const { data: call, error } = await supabase
          .from('calls')
          .update(updateData)
          .eq('id', callId)
          .eq('clinic_id', authContext.clinic_id)
          .select()
          .single();

        if (error) throw error;

        // Write audit log
        await supabase
          .from('audit_log')
          .insert({
            clinic_id: authContext.clinic_id,
            entity: 'call',
            entity_id: callId,
            action: 'call.updated',
            actor: authContext.user.email || 'system',
            diff_json: updateData
          });

        return new Response(
          JSON.stringify({ success: true, call }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_call_history': {
        const { callId } = requestBody;
        
        const { data: call, error: callError } = await supabase
          .from('calls')
          .select('*')
          .eq('id', callId)
          .eq('clinic_id', authContext.clinic_id)
          .single();

        if (callError) throw callError;

        const { data: turns, error: turnsError } = await supabase
          .from('turns')
          .select('*')
          .eq('call_id', callId)
          .order('at', { ascending: true });

        if (turnsError) throw turnsError;

        return new Response(
          JSON.stringify({ 
            success: true, 
            call: { ...call, turns } 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error) {
    console.error('Call Manager Error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        status: error.message.includes('Authentication') ? 401 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});