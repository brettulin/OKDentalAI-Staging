import "https://deno.land/x/xhr@0.1.0/mod.ts";
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

    console.log(`AI Call Handler: ${type} for call ${callId}`);

    switch (type) {
      case 'simulate_call': {
        // Get clinic info for context
        const { data: clinic } = await supabase
          .from('clinics')
          .select('name, main_phone, timezone')
          .single();

        // Create a simulated call with realistic conversation
        const callData = {
          clinic_id: requestBody.clinic_id,
          office_id: officeId || null,
          started_at: new Date().toISOString(),
          ended_at: new Date(Date.now() + Math.random() * 300000).toISOString(), // Random duration up to 5 min
          outcome: 'appointment_booked' as CallOutcome,
          transcript_json: {
            scenario: scenario || 'appointment_booking',
            simulation: true,
            ai_version: '1.0',
            clinic_name: clinic?.name
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
            { role: 'assistant', text: `Hello! Thank you for calling ${clinic?.name || 'our dental office'}. I'd be happy to help you schedule an appointment. May I have your name and phone number?` },
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

      case 'process_message': {
        if (!callId || !userMessage) {
          throw new Error('callId and userMessage are required');
        }

        // Get conversation context
        const { data: existingTurns } = await supabase
          .from('turns')
          .select('*')
          .eq('call_id', callId)
          .order('at', { ascending: true });

        // Add user message to database
        const { error: userTurnError } = await supabase
          .from('turns')
          .insert({
            call_id: callId,
            role: 'user',
            text: userMessage,
            at: new Date().toISOString()
          });

        if (userTurnError) {
          console.error('User turn creation error:', userTurnError);
          throw userTurnError;
        }

        // Get AI response
        let aiResponse = '';
        let intent = 'general_inquiry';
        let actions = ['respond'];

        const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
        
        if (openaiApiKey) {
          // Use OpenAI for intelligent responses
          try {
            const conversationContext = (existingTurns || []).map(turn => ({
              role: turn.role,
              content: turn.text
            }));

            const systemPrompt = `You are an AI dental office receptionist. You are helpful, professional, and efficient. Your main tasks are:
1. Schedule appointments for patients
2. Answer questions about dental services
3. Handle emergency requests
4. Collect patient information
5. Transfer calls to human staff when needed

Keep responses concise and friendly. If booking appointments, ask for name, phone, and preferred times. For emergencies, prioritize urgent scheduling.`;

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                  { role: 'system', content: systemPrompt },
                  ...conversationContext,
                  { role: 'user', content: userMessage }
                ],
                max_tokens: 150,
                temperature: 0.7,
              }),
            });

            if (response.ok) {
              const data = await response.json();
              aiResponse = data.choices[0].message.content;
              
              // Analyze intent based on message content
              const lowerMessage = userMessage.toLowerCase();
              if (lowerMessage.includes('appointment') || lowerMessage.includes('book') || lowerMessage.includes('schedule')) {
                intent = 'book_appointment';
                actions = ['collect_info', 'check_availability'];
              } else if (lowerMessage.includes('emergency') || lowerMessage.includes('pain') || lowerMessage.includes('urgent')) {
                intent = 'emergency';
                actions = ['urgent_scheduling'];
              } else if (lowerMessage.includes('cancel') || lowerMessage.includes('reschedule')) {
                intent = 'modify_appointment';
                actions = ['lookup_appointment'];
              }
            } else {
              console.error('OpenAI API error:', await response.text());
              throw new Error('OpenAI API error');
            }
          } catch (error) {
            console.error('OpenAI processing error:', error);
            // Fall back to simple responses
            aiResponse = generateFallbackResponse(userMessage);
          }
        } else {
          // Use fallback responses when no API key
          aiResponse = generateFallbackResponse(userMessage);
        }

        // Add AI response to database
        const { error: assistantTurnError } = await supabase
          .from('turns')
          .insert({
            call_id: callId,
            role: 'assistant', 
            text: aiResponse,
            at: new Date(Date.now() + 1000).toISOString(),
            meta: { intent, actions }
          });

        if (assistantTurnError) {
          console.error('Assistant turn creation error:', assistantTurnError);
          throw assistantTurnError;
        }

        return new Response(
          JSON.stringify({
            success: true,
            response: aiResponse,
            intent,
            actions,
            context: { ...context, last_response: aiResponse, intent }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_calls': {
        const limit = requestBody.limit || 50;
        const clinicId = requestBody.clinic_id;
        
        if (!clinicId) {
          throw new Error('clinic_id is required');
        }
        
        const { data: calls, error } = await supabase
          .from('calls')
          .select(`
            *,
            turns:turns(count)
          `)
          .eq('clinic_id', clinicId)
          .order('started_at', { ascending: false })
          .limit(limit);

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, calls }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_call_details': {
        const { callId, clinic_id } = requestBody;
        
        if (!callId || !clinic_id) {
          throw new Error('callId and clinic_id are required');
        }
        
        const { data: call, error: callError } = await supabase
          .from('calls')
          .select('*')
          .eq('id', callId)
          .eq('clinic_id', clinic_id)
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

function generateFallbackResponse(userMessage: string): string {
  const lowerMessage = userMessage.toLowerCase();
  
  if (lowerMessage.includes('appointment') || lowerMessage.includes('book') || lowerMessage.includes('schedule')) {
    return "I'd be happy to help you schedule an appointment. Could you please provide your name and phone number, and let me know what type of appointment you need?";
  }
  
  if (lowerMessage.includes('emergency') || lowerMessage.includes('pain') || lowerMessage.includes('urgent')) {
    return "I understand this is urgent. Let me check our emergency availability right away. Can you describe your situation briefly?";
  }
  
  if (lowerMessage.includes('cancel') || lowerMessage.includes('reschedule')) {
    return "I can help you with that. Could you please provide your name and phone number so I can look up your appointment?";
  }
  
  if (lowerMessage.includes('hours') || lowerMessage.includes('open')) {
    return "Our office hours are Monday through Friday, 8 AM to 6 PM, and Saturday 9 AM to 2 PM. Is there anything else I can help you with?";
  }
  
  if (lowerMessage.includes('location') || lowerMessage.includes('address')) {
    return "We're conveniently located in the heart of the city. Would you like me to provide directions or help you schedule an appointment?";
  }
  
  // Default responses
  const responses = [
    "I understand. How can I help you with that today?",
    "Could you provide a bit more information so I can better assist you?",
    "I'm here to help. What specific information or service are you looking for?",
    "Let me help you with that. Can you tell me more about what you need?",
    "I'd be happy to assist you. Could you clarify what you're looking for?"
  ];

  return responses[Math.floor(Math.random() * responses.length)];
}