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
    const { type, scenario, callId, userMessage, conversationHistory, context, officeId } = requestBody;

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

    console.log(`AI Call Handler: ${type} for clinic ${profile.clinic_id}`);

    switch (type) {
      case 'simulate_call': {
        // Create a simulated call with realistic conversation
        const callData = {
          clinic_id: profile.clinic_id,
          office_id: officeId || null,
          started_at: new Date().toISOString(),
          ended_at: new Date(Date.now() + Math.random() * 300000).toISOString(), // Random duration up to 5 min
          outcome: 'appointment_booked' as CallOutcome,
          transcript_json: {
            scenario: scenario || 'appointment_booking',
            simulation: true,
            ai_version: '1.0'
          }
        };

        const { data: call, error: callError } = await supabase
          .from('calls')
          .insert(callData)
          .select()
          .single();

        if (callError) {
          console.error('Call creation error:', callError);
          throw callError;
        }

        // Create conversation turns based on scenario
        const turns = [];
        const scenarios = {
          appointment_booking: [
            { role: 'user', text: 'Hi, I need to book a dental appointment' },
            { role: 'assistant', text: 'I\'d be happy to help you schedule an appointment. May I have your name and phone number?' },
            { role: 'user', text: 'Sure, it\'s John Smith, 555-123-4567' },
            { role: 'assistant', text: 'Thank you, Mr. Smith. I found your information. What type of appointment do you need?' },
            { role: 'user', text: 'Just a regular cleaning and checkup' },
            { role: 'assistant', text: 'Perfect! I have availability next Tuesday at 2 PM or Thursday at 10 AM. Which works better for you?' },
            { role: 'user', text: 'Thursday at 10 AM sounds great' },
            { role: 'assistant', text: 'Excellent! I\'ve booked your appointment for Thursday at 10 AM. You\'ll receive a confirmation email shortly.' }
          ],
          emergency: [
            { role: 'user', text: 'I have a terrible toothache and need to see someone today!' },
            { role: 'assistant', text: 'I\'m sorry to hear about your pain. Let me check our emergency availability today.' },
            { role: 'user', text: 'Please, it really hurts' },
            { role: 'assistant', text: 'I understand. I can get you in today at 3:30 PM for an emergency consultation. Can you make it then?' },
            { role: 'user', text: 'Yes, absolutely!' },
            { role: 'assistant', text: 'Your emergency appointment is confirmed for today at 3:30 PM. Please arrive 15 minutes early.' }
          ]
        };

        const selectedScenario = scenarios[scenario as keyof typeof scenarios] || scenarios.appointment_booking;
        
        for (let i = 0; i < selectedScenario.length; i++) {
          const turn = selectedScenario[i];
          turns.push({
            call_id: call.id,
            role: turn.role,
            text: turn.text,
            at: new Date(Date.now() + i * 10000).toISOString(), // 10 seconds between turns
            meta: { simulation: true, turn_index: i }
          });
        }

        const { error: turnsError } = await supabase
          .from('turns')
          .insert(turns);

        if (turnsError) {
          console.error('Turns creation error:', turnsError);
          throw turnsError;
        }

        return new Response(
          JSON.stringify({
            success: true,
            call_id: call.id,
            turns_created: turns.length,
            outcome: call.outcome,
            duration: Math.round((new Date(call.ended_at!).getTime() - new Date(call.started_at).getTime()) / 1000)
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_calls': {
        const limit = requestBody.limit || 50;
        
        const { data: calls, error } = await supabase
          .from('calls')
          .select(`
            *,
            turns:turns(count)
          `)
          .eq('clinic_id', profile.clinic_id)
          .order('started_at', { ascending: false })
          .limit(limit);

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, calls }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_call_details': {
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

      case 'process_message': {
        // Simple AI response logic for simulation
        const responses = [
          "I understand. Let me help you with that.",
          "Can you provide more details about what you need?",
          "I'll check our availability for you.",
          "Perfect! Let me process that information.",
          "Is there anything else I can help you with today?"
        ];

        const response = responses[Math.floor(Math.random() * responses.length)];
        
        // Add the turn to the database
        const { error: turnError } = await supabase
          .from('turns')
          .insert({
            call_id: callId,
            role: 'user',
            text: userMessage,
            at: new Date().toISOString()
          });

        if (turnError) {
          console.error('Turn creation error:', turnError);
        }

        const { error: assistantTurnError } = await supabase
          .from('turns')
          .insert({
            call_id: callId,
            role: 'assistant', 
            text: response,
            at: new Date(Date.now() + 1000).toISOString()
          });

        if (assistantTurnError) {
          console.error('Assistant turn creation error:', assistantTurnError);
        }

        return new Response(
          JSON.stringify({
            success: true,
            response,
            intent: 'general_inquiry',
            actions: ['respond'],
            context: { ...context, last_response: response }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error(`Unknown action type: ${type}`);
    }

  } catch (error) {
    console.error('AI Call Handler Error:', error);
    
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