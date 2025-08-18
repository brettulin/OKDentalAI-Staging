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
    const startTime = Date.now();
    
    // Parse form data from Twilio FIRST (blocking operation)
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

    console.log(`[ULTRA-FAST] Handler started for ${CallSid || 'unknown'}`);

    if (!CallSid) {
      throw new Error('No CallSid provided');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const dbStartTime = Date.now();
    const userMessage = SpeechResult || "Hello, I'd like to schedule an appointment.";

    // PHASE 1: MAXIMUM PARALLEL OPTIMIZATION - All operations simultaneous
    const [phoneResult, aiResponsePromise, ttsConfigPromise] = await Promise.allSettled([
      // Single optimized query for phone + AI settings
      supabase
        .from('phone_numbers')
        .select(`
          clinic_id,
          clinics!inner(
            ai_settings!inner(voice_id, voice_model)
          )
        `)
        .eq('e164', To)
        .eq('status', 'active')
        .single(),
      
      // AI generation starts immediately - NO WAITING
      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Dental receptionist. 1 sentence only.' },
            { role: 'user', content: userMessage }
          ],
          max_tokens: 8, // MAXIMUM aggressive reduction
          temperature: 0.1, // Fastest possible
        }),
      }),
      
      // TTS config - instant
      Promise.resolve({
        model_id: 'eleven_turbo_v2_5',
        output_format: 'mp3_22050_32',
        voice_settings: {
          stability: 0.3, // ULTRA optimized for max speed
          similarity_boost: 0.4, // Minimal for speed
          style: 0.0,
          use_speaker_boost: true
        }
      })
    ]);

    const dbEndTime = Date.now();

    // Handle failures
    if (phoneResult.status === 'rejected' || !phoneResult.value.data) {
      console.error('No active phone number found for:', To);
      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response><Say>Service unavailable.</Say><Hangup/></Response>', {
        headers: { 'Content-Type': 'text/xml' }
      });
    }

    const phoneData = phoneResult.value.data;
    const voiceId = phoneData.clinics?.ai_settings?.voice_id || 'sIak7pFapfSLCfctxdOu';

    // Extract AI response - CRITICAL FIX: Actually await the AI response
    let aiResponse = "How can I help you today?";
    let aiEndTime = Date.now();
    
    if (aiResponsePromise.status === 'fulfilled') {
      try {
        const data = await aiResponsePromise.value.json();
        aiResponse = data.choices[0]?.message?.content || aiResponse;
        aiEndTime = Date.now();
      } catch (error) {
        console.error('AI response parsing error:', error);
      }
    }

    // Get TTS config
    const ttsConfig = ttsConfigPromise.status === 'fulfilled' ? ttsConfigPromise.value : {
      model_id: 'eleven_turbo_v2_5',
      output_format: 'mp3_22050_32',
      voice_settings: { stability: 0.4, similarity_boost: 0.5, style: 0.0, use_speaker_boost: true }
    };

    const ttsStartTime = Date.now();

    // PHASE 4: FASTEST TTS with ultra-optimized settings
    const ttsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': Deno.env.get('ELEVENLABS_API_KEY'),
        'content-type': 'application/json',
        'accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text: aiResponse,
        ...ttsConfig
      }),
    });

    const ttsEndTime = Date.now();

    if (ttsResponse.ok) {
      const audioBuffer = await ttsResponse.arrayBuffer();
      
      // PHASE 2: ELIMINATE STORAGE BOTTLENECK - Direct base64 streaming
      const base64StartTime = Date.now();
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));
      const base64EndTime = Date.now();
      
      const totalTime = Date.now() - startTime;

      // BACKGROUND TASK: Async transcript logging (non-blocking)
      const transcriptPromise = supabase
        .from('turns')
        .insert([
          {
            call_id: CallSid,
            role: 'user',
            text: userMessage,
            meta: { timestamp: new Date().toISOString(), processing_time_ms: totalTime }
          },
          {
            call_id: CallSid,
            role: 'assistant',
            text: aiResponse,
            meta: { 
              timestamp: new Date().toISOString(),
              voice_id: voiceId,
              model: 'eleven_turbo_v2_5',
              processing_time_ms: totalTime
            }
          }
        ]);

      // ULTRA-PERFORMANCE MONITORING
      console.log(JSON.stringify({
        tag: "twilio-clarice-voice:phase2-optimized",
        CallSid,
        breakdown: {
          db_parallel_ms: dbEndTime - dbStartTime,
          ai_generation_ms: aiEndTime - aiStartTime,
          tts_generation_ms: ttsEndTime - ttsStartTime,
          base64_conversion_ms: base64EndTime - base64StartTime,
          total_ms: totalTime
        },
        optimizations: {
          model: "eleven_turbo_v2_5",
          max_parallel: true,
          storage_eliminated: true,
          direct_base64_streaming: true,
          ultra_compressed_ai: true
        },
        performance_target: "sub_800ms",
        actual_performance: totalTime < 800 ? "TARGET_MET" : totalTime < 1000 ? "CLOSE" : "TARGET_MISSED"
      }));

      // PHASE 2: DIRECT BASE64 RESPONSE - Maximum speed
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
      
      // INSTANT FALLBACK - No delay
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