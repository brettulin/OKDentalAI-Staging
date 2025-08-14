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
    console.log('ElevenLabs Voice Handler received:', req.method);
    
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
      // Create call if not exists
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
      console.error('Could not find or create call for:', CallSid);
      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response><Say>I apologize, but I cannot process your request right now.</Say><Hangup/></Response>', {
        headers: { 'Content-Type': 'text/xml' }
      });
    }

    // Get AI settings with ElevenLabs voice
    const { data: aiSettings } = await supabase
      .from('ai_settings')
      .select('*')
      .eq('clinic_id', call.clinic_id)
      .single();

    const { data: clinic } = await supabase
      .from('clinics')
      .select('name')
      .eq('id', call.clinic_id)
      .single();

    const userMessage = SpeechResult || "Hello, I'd like to schedule an appointment.";
    
    // Generate AI response using faster model with very short responses
    const systemPrompt = `You are an AI dental receptionist for ${clinic?.name || 'our dental clinic'}. 
    Respond in exactly 1 sentence. Be direct and helpful.
    Help with: appointments, questions, messages.`;

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
        max_tokens: 50, // Very short for speed
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

    // Force use of clarice voice
    const voiceId = 'sIak7pFapfSLCfctxdOu'; // clarice voice ID
    console.log('Using ElevenLabs clarice voice:', voiceId);

    console.log('Calling ElevenLabs TTS with text:', aiResponse);
    const ttsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': Deno.env.get('ELEVENLABS_API_KEY'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: aiResponse,
        model_id: 'eleven_turbo_v2_5', // Fastest model for lowest latency
        voice_settings: {
          stability: 0.4,
          similarity_boost: 0.8,
          style: 0.0,
          use_speaker_boost: false // Disable for speed
        },
        output_format: "mp3_22050_32" // Lower quality for speed
      }),
    });

    console.log('ElevenLabs TTS Response Status:', ttsResponse.status);
    
    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      console.error('ElevenLabs TTS error:', errorText);
      // Fallback to simple TwiML without custom audio
      return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${aiResponse}</Say>
  <Gather action="https://zvpezltqpphvolzgfhme.functions.supabase.co/functions/v1/twilio-elevenlabs-voice" method="POST" timeout="5" input="speech" speechTimeout="auto">
    <Say voice="Polly.Joanna">Please let me know if you need anything else.</Say>
  </Gather>
  <Say voice="Polly.Joanna">Thank you for calling. Goodbye!</Say>
  <Hangup/>
</Response>`, {
        headers: { 'Content-Type': 'text/xml' }
      });
    }

    // Convert audio to base64 for Twilio
    const audioBuffer = await ttsResponse.arrayBuffer();
    console.log('Audio buffer size:', audioBuffer.byteLength);
    
    if (audioBuffer.byteLength === 0) {
      console.error('Empty audio buffer received from ElevenLabs');
      // Use fallback voice
      return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${aiResponse}</Say>
  <Gather action="https://zvpezltqpphvolzgfhme.functions.supabase.co/functions/v1/twilio-elevenlabs-voice" method="POST" timeout="5" input="speech" speechTimeout="auto">
    <Say voice="Polly.Joanna">Please let me know if you need anything else.</Say>
  </Gather>
  <Say voice="Polly.Joanna">Thank you for calling. Goodbye!</Say>
  <Hangup/>
</Response>`, {
        headers: { 'Content-Type': 'text/xml' }
      });
    }

    const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));
    console.log('Generated base64 audio length:', base64Audio.length);

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

    // Return TwiML with audio and faster timeouts
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>data:audio/mpeg;base64,${base64Audio}</Play>
  <Gather action="https://zvpezltqpphvolzgfhme.functions.supabase.co/functions/v1/twilio-elevenlabs-voice" method="POST" timeout="5" input="speech" speechTimeout="2">
    <Pause length="0.5"/>
  </Gather>
  <Say voice="Polly.Joanna-Neural">Thank you for calling!</Say>
  <Hangup/>
</Response>`;

    console.log('Returning TwiML with clarice voice audio');

    return new Response(twimlResponse, {
      headers: { 'Content-Type': 'text/xml' }
    });

  } catch (error) {
    console.error('ElevenLabs Voice Handler error:', error);
    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">I apologize for the technical difficulty. Please call back later.</Say><Hangup/></Response>', {
      status: 500,
      headers: { 'Content-Type': 'text/xml' }
    });
  }
});