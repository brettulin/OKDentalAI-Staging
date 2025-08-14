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
    console.log('Clarice Voice Handler received:', req.method);
    
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

    console.log('Webhook data:', JSON.stringify(webhookData, null, 2));

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
        console.log('Created new call record:', call?.id);
      }
    }

    if (!call) {
      console.error('Could not find or create call for:', CallSid);
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
    console.log('User said:', userMessage);
    
    // Generate AI response using faster model
    const systemPrompt = `You are an AI dental receptionist for ${clinic?.name || 'our dental clinic'}. 
    Respond in exactly 1 sentence. Be direct and helpful.
    Help with: appointments, questions, messages.`;

    console.log('Generating AI response...');

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
        max_tokens: 50,
        temperature: 0.5,
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

    // Generate speech with ElevenLabs using YOUR clarice voice
    const clariceVoiceId = 'sIak7pFapfSLCfctxdOu';
    console.log('Using clarice voice:', clariceVoiceId);

    const ttsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${clariceVoiceId}/stream`, {
      method: 'POST',
      headers: {
        'xi-api-key': Deno.env.get('ELEVENLABS_API_KEY'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: aiResponse,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
          style: 0.0,
          use_speaker_boost: true
        }
      }),
    });

    console.log('ElevenLabs TTS Response Status:', ttsResponse.status);

    if (ttsResponse.ok) {
      // Get the audio as array buffer
      const audioBuffer = await ttsResponse.arrayBuffer();
      console.log('Audio buffer size:', audioBuffer.byteLength);
      
      // Convert to base64
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));
      console.log('Generated base64 audio, length:', base64Audio.length);

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

      // Return TwiML with YOUR clarice voice audio
      const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>data:audio/mpeg;base64,${base64Audio}</Play>
  <Gather action="https://zvpezltqpphvolzgfhme.functions.supabase.co/functions/v1/twilio-clarice-voice" method="POST" timeout="8" input="speech" speechTimeout="auto">
    <Pause length="1"/>
  </Gather>
  <Say voice="Polly.Joanna-Neural">Thank you for calling!</Say>
  <Hangup/>
</Response>`;

      console.log('Returning TwiML with clarice voice audio');
      return new Response(twimlResponse, {
        headers: { 'Content-Type': 'text/xml' }
      });

    } else {
      const errorText = await ttsResponse.text();
      console.error('ElevenLabs TTS error:', errorText);
      
      // Fallback to simple voice
      const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna-Neural">${aiResponse}</Say>
  <Gather action="https://zvpezltqpphvolzgfhme.functions.supabase.co/functions/v1/twilio-clarice-voice" method="POST" timeout="8" input="speech" speechTimeout="auto">
    <Say voice="Polly.Joanna-Neural">How else can I help?</Say>
  </Gather>
  <Say voice="Polly.Joanna-Neural">Thank you for calling!</Say>
  <Hangup/>
</Response>`;

      return new Response(twimlResponse, {
        headers: { 'Content-Type': 'text/xml' }
      });
    }

  } catch (error) {
    console.error('Clarice Voice Handler error:', error);
    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna-Neural">I apologize for the technical difficulty. Please call back later.</Say><Hangup/></Response>', {
      status: 500,
      headers: { 'Content-Type': 'text/xml' }
    });
  }
});