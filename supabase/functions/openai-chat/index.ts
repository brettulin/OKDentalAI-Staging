import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getAuthContext } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authContext = await getAuthContext(req);
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { messages, callId, aiSettings } = await req.json();

    if (!Deno.env.get('OPENAI_API_KEY')) {
      throw new Error('OpenAI API key not configured');
    }

    // Get clinic context for personalized responses
    const { data: clinic } = await supabase
      .from('clinics')
      .select('*')
      .eq('id', authContext.clinic_id)
      .single();

    // Get providers and services for better context
    const { data: providers } = await supabase
      .from('providers')
      .select('name, specialty')
      .eq('clinic_id', authContext.clinic_id);

    const { data: services } = await supabase
      .from('services')
      .select('name, duration_min')
      .eq('clinic_id', authContext.clinic_id);

    // Build system prompt with clinic context
    const systemPrompt = `You are an AI receptionist for ${clinic?.name || 'the clinic'}. ${aiSettings?.custom_greeting || 'You help patients with appointments and basic questions.'} 

Available providers: ${providers?.map(p => `${p.name} (${p.specialty})`).join(', ') || 'General dental services'}
Available services: ${services?.map(s => `${s.name} (${s.duration_min} min)`).join(', ') || 'General dental services'}

IMPORTANT INSTRUCTIONS:
- Be friendly, professional, and helpful
- For appointments, collect: patient name, phone number, preferred date/time, service needed
- Use the exact patient phone number format they provide for lookup
- If you can't help with something, offer to have someone call them back
- Keep responses concise and natural (under 100 words)
- Use the patient's name when you know it
- For existing patients, confirm their information before booking
- For new patients, collect basic information (name, phone, email if available)
- Always suggest next available appointments if their preference isn't available
- If they need urgent care, prioritize immediate scheduling

CONVERSATION FLOW:
1. Greet and ask how you can help
2. If booking appointment: get patient phone → look up/create patient → find available slots → confirm booking
3. If general inquiry: provide helpful information
4. If complex issue: offer to transfer to staff member`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        temperature: 0.7,
        max_tokens: 500,
        presence_penalty: 0.1,
        frequency_penalty: 0.1
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    // Store the conversation turn
    if (callId) {
      await supabase
        .from('call_turns')
        .insert({
          call_id: callId,
          speaker: 'ai',
          message: aiResponse,
          timestamp: new Date().toISOString()
        });
    }

    // Log the AI interaction
    await supabase
      .from('audit_log')
      .insert({
        clinic_id: authContext.clinic_id,
        entity: 'ai_chat',
        entity_id: callId,
        action: 'message_processed',
        actor: authContext.user.email || 'system',
        diff_json: {
          input_tokens: data.usage?.prompt_tokens,
          output_tokens: data.usage?.completion_tokens,
          model: 'gpt-4.1-2025-04-14'
        }
      });

    return new Response(
      JSON.stringify({ 
        response: aiResponse,
        usage: data.usage 
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        } 
      }
    );

  } catch (error) {
    console.error('OpenAI Chat Error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        fallback: "I'm having trouble processing your request right now. Please hold while I connect you with someone who can help."
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        } 
      }
    );
  }
});