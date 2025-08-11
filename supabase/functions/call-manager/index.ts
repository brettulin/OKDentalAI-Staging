import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const requestBody = await req.json();
    const { action } = requestBody;

    // Get Authorization header for user authentication
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      supabase.auth.setAuth(authHeader.replace('Bearer ', ''));
    }

    // Get user's clinic
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Authentication required');
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('clinic_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.clinic_id) {
      throw new Error('User not associated with a clinic');
    }

    console.log(`Call Manager: ${action} for clinic ${profile.clinic_id}`);

    switch (action) {
      case 'start_call': {
        const { callId, officeId, twilioCallSid, fromNumber, toNumber } = requestBody;
        
        const callData = {
          id: callId,
          clinic_id: profile.clinic_id,
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
          .eq('clinic_id', profile.clinic_id)
          .select()
          .single();

        if (error) throw error;

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
          .eq('clinic_id', profile.clinic_id)
          .select()
          .single();

        if (error) throw error;

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
          .eq('clinic_id', profile.clinic_id)
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
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});