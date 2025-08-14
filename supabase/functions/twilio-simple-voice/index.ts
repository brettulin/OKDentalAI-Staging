import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Simple Voice Handler received:', req.method);
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse form data from Twilio
    const formData = await req.formData();
    const webhookData: Record<string, string> = {};
    
    for (const [key, value] of formData.entries()) {
      webhookData[key] = value.toString();
    }

    console.log('Webhook data:', webhookData);

    const {
      CallSid,
      SpeechResult,
      From,
      To
    } = webhookData;

    if (!CallSid) {
      throw new Error('No CallSid provided');
    }

    // Get or create call record
    let { data: call } = await supabase
      .from('calls')
      .select('id, clinic_id, caller_phone')
      .eq('twilio_call_sid', CallSid)
      .single();

    if (!call) {
      const { data: clinic } = await supabase
        .from('clinics')
        .select('id')
        .eq('main_phone', To)
        .single();

      if (clinic) {
        const { data: newCall } = await supabase
          .from('calls')
          .insert({
            twilio_call_sid: CallSid,
            clinic_id: clinic.id,
            caller_phone: From,
            status: 'in-progress'
          })
          .select()
          .single();
        
        call = newCall;
      }
    }

    if (!call) {
      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response><Say>I apologize, but I cannot process your request right now.</Say><Hangup/></Response>', {
        headers: { 'Content-Type': 'text/xml' }
      });
    }

    const { data: clinic } = await supabase
      .from('clinics')
      .select('name')
      .eq('id', call.clinic_id)
      .single();

    const userMessage = SpeechResult || "Hello, I'd like to schedule an appointment.";
    
    // Generate AI response using faster model
    const systemPrompt = `You are a helpful AI dental receptionist for ${clinic?.name || 'our dental clinic'}. 
    Keep responses very brief (1-2 sentences max) and professional. Help with:
    - Scheduling appointments 
    - Basic questions about services
    - Taking messages
    
    Always be conversational and ask follow-up questions.`;

    console.log('Generating AI response for:', userMessage);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        max_tokens: 80,
        temperature: 0.7,
      }),
    });

    let aiResponse = "Thank you for calling. How can I help you today?";
    
    if (response.ok) {
      const data = await response.json();
      aiResponse = data.choices[0]?.message?.content || aiResponse;
      console.log('AI Response:', aiResponse);
    } else {
      console.error('OpenAI API error:', await response.text());
    }

    // Store conversation
    await supabase
      .from('turns')
      .insert([
        {
          call_id: call.id,
          role: 'user',
          text: userMessage,
        },
        {
          call_id: call.id,
          role: 'assistant',
          text: aiResponse,
        }
      ]);

    // Return simple TwiML - more reliable than base64 audio
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna-Neural">${aiResponse}</Say>
  <Gather action="https://zvpezltqpphvolzgfhme.functions.supabase.co/functions/v1/twilio-simple-voice" method="POST" timeout="8" input="speech" speechTimeout="auto">
    <Say voice="Polly.Joanna-Neural">How else can I help you?</Say>
  </Gather>
  <Say voice="Polly.Joanna-Neural">Thank you for calling. Have a wonderful day!</Say>
  <Hangup/>
</Response>`;

    console.log('Returning simple TwiML response');
    return new Response(twimlResponse, {
      headers: { 'Content-Type': 'text/xml' }
    });

  } catch (error) {
    console.error('Simple Voice Handler error:', error);
    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna-Neural">I apologize for the technical difficulty. Please call back later.</Say><Hangup/></Response>', {
      status: 500,
      headers: { 'Content-Type': 'text/xml' }
    });
  }
});