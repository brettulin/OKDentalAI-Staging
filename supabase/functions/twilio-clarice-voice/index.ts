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
    const t0 = Date.now(); // handler_in

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

    const {
      CallSid,
      SpeechResult,
      From,
      To
    } = webhookData;

    if (!CallSid) {
      throw new Error('No CallSid provided');
    }

    // OPTIMIZATION: Parallel DB queries to reduce latency
    const [phoneNumberResult, aiSettingsResult] = await Promise.all([
      supabase
        .from('phone_numbers')
        .select('clinic_id')
        .eq('e164', To)
        .eq('status', 'active')
        .single(),
      // Pre-fetch ai_settings in parallel using a join query
      supabase
        .from('phone_numbers')
        .select(`
          clinic_id,
          ai_settings!inner(voice_id, voice_model)
        `)
        .eq('e164', To)
        .eq('status', 'active')
        .single()
    ]);

    const { data: phoneNumber } = phoneNumberResult;
    const { data: phoneWithSettings } = aiSettingsResult;

    if (!phoneNumber) {
      console.error('No active phone number found for:', To);
      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response><Say>Service unavailable.</Say><Hangup/></Response>', {
        headers: { 'Content-Type': 'text/xml' }
      });
    }

    const userMessage = SpeechResult || "Hello, I'd like to schedule an appointment.";
    
    // Use voice_id from settings, fallback to Clarice
    const voiceId = phoneWithSettings?.ai_settings?.voice_id || 'sIak7pFapfSLCfctxdOu';
    
    // OPTIMIZATION: Parallel AI and TTS preparation
    const systemPrompt = `Clarice, dental receptionist. Be helpful, brief.`;

    // Start AI generation and prepare TTS settings in parallel
    const [aiResponseResult] = await Promise.all([
      fetch('https://api.openai.com/v1/chat/completions', {
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
          max_tokens: 15, // OPTIMIZATION: Reduced tokens for faster response
          temperature: 0.3, // OPTIMIZATION: Lower temperature for faster processing
        }),
      })
    ]);

    let aiResponse = "How can I help you today?";
    
    if (aiResponseResult.ok) {
      const data = await aiResponseResult.json();
      aiResponse = data.choices[0]?.message?.content || aiResponse;
    }

    // OPTIMIZATION: Use eleven_turbo_v2_5 for faster TTS
    const ttsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': Deno.env.get('ELEVENLABS_API_KEY'),
        'content-type': 'application/json',
        'accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text: aiResponse,
        model_id: 'eleven_turbo_v2_5', // OPTIMIZATION: Faster model
        output_format: 'mp3_22050_32',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
          style: 0.0,
          use_speaker_boost: true
        }
      }),
    });

    const t1 = Date.now(); // tts_done

    if (ttsResponse.ok) {
      const audioBuffer = await ttsResponse.arrayBuffer();
      
      // OPTIMIZATION: Return audio directly as base64 - eliminates storage upload latency
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));
      
      const t2 = Date.now(); // base64_done

      // Log optimized timing
      console.log(JSON.stringify({
        tag: "twilio-clarice-voice:timing-optimized",
        CallSid, 
        tts_ms: t1-t0, 
        base64_ms: t2-t1, 
        total_ms: t2-t0,
        optimization: "direct_base64_no_upload"
      }));

      // Return TwiML with base64 audio directly
      return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>data:audio/mpeg;base64,${base64Audio}</Play>
  <Gather action="https://zvpezltqpphvolzgfhme.functions.supabase.co/functions/v1/twilio-clarice-voice" method="POST" input="speech" speechTimeout="3" timeout="5" actionOnEmptyResult="true" bargeIn="true">
    <Pause length="1"/>
  </Gather>
</Response>`, {
        headers: { 'Content-Type': 'text/xml' }
      });

    } else {
      const errorText = await ttsResponse.text();
      console.error('ElevenLabs TTS error:', errorText);
      
      // Fallback to Polly
      return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna-Neural">${aiResponse}</Say>
  <Gather action="https://zvpezltqpphvolzgfhme.functions.supabase.co/functions/v1/twilio-clarice-voice" method="POST" input="speech" speechTimeout="3" timeout="5" actionOnEmptyResult="true" bargeIn="true">
    <Pause length="1"/>
  </Gather>
</Response>`, {
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