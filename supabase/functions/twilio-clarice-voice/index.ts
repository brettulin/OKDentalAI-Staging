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

    // PHASE 1: OPTIMIZED PARALLEL DATABASE + AI + TTS PREP - ALL SIMULTANEOUS
    const [phoneResult, aiResponsePromise, ttsConfigPromise] = await Promise.allSettled([
      // Single phone lookup with clinic data join for maximum efficiency
      supabase
        .from('phone_numbers')
        .select('clinic_id, ai_settings!inner(voice_id, voice_model)')
        .eq('e164', To)
        .eq('status', 'active')
        .single(),
      
      // AI generation starts immediately in parallel
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
          max_tokens: 10, // ULTRA aggressive token reduction
          temperature: 0.2, // Slight reduction for speed
        }),
      }),
      
      // TTS config preparation (instant resolution)
      Promise.resolve({
        model_id: 'eleven_turbo_v2_5',
        output_format: 'mp3_22050_32',
        voice_settings: {
          stability: 0.4, // Optimized for speed
          similarity_boost: 0.5, // Further reduced for max speed
          style: 0.0,
          use_speaker_boost: true
        }
      })
    ]);

    const dbEndTime = Date.now();

    // Handle phone number lookup failure
    if (phoneResult.status === 'rejected' || !phoneResult.value.data) {
      console.error('No active phone number found for:', To);
      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response><Say>Service unavailable.</Say><Hangup/></Response>', {
        headers: { 'Content-Type': 'text/xml' }
      });
    }

    const phoneData = phoneResult.value.data;
    const voiceId = phoneData.ai_settings?.voice_id || 'sIak7pFapfSLCfctxdOu';

    const aiEndTime = Date.now();

    // Extract AI response
    let aiResponse = "How can I help you today?";
    if (aiResponsePromise.status === 'fulfilled' && aiResponsePromise.value.ok) {
      const data = await aiResponsePromise.value.json();
      aiResponse = data.choices[0]?.message?.content || aiResponse;
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
      
      // PHASE 5: PARALLEL STORAGE + BASE64 CONVERSION
      const base64StartTime = Date.now();
      const audioArray = new Uint8Array(audioBuffer);
      
      const [storageResult] = await Promise.allSettled([
        // Background storage for transcript preservation (async, non-blocking)
        supabase.storage
          .from('audio')
          .upload(`audio/sessions/${CallSid}/${Date.now()}.mp3`, audioArray, {
            contentType: 'audio/mpeg',
            upsert: true
          })
      ]);

      // Get public URL immediately (don't wait for upload)
      const { data: { publicUrl } } = supabase.storage
        .from('audio')
        .getPublicUrl(`audio/sessions/${CallSid}/${Date.now()}.mp3`);

      const base64EndTime = Date.now();
      const totalTime = Date.now() - startTime;

      // PHASE 6: ENHANCED PERFORMANCE MONITORING
      console.log(JSON.stringify({
        tag: "twilio-clarice-voice:ultra-optimized",
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
          parallel_queries: true,
          compressed_prompt: true,
          optimized_voice_settings: true
        },
        performance_target: "sub_1000ms",
        actual_performance: totalTime < 1000 ? "TARGET_MET" : "TARGET_MISSED"
      }));

      // Save transcript to database (preserve core feature)
      supabase
        .from('turns')
        .insert({
          call_id: CallSid,
          role: 'user',
          text: userMessage,
          meta: { timestamp: new Date().toISOString(), processing_time_ms: totalTime }
        })
        .then(() => {
          supabase
            .from('turns')
            .insert({
              call_id: CallSid,
              role: 'assistant',
              text: aiResponse,
              meta: { 
                timestamp: new Date().toISOString(),
                voice_id: voiceId,
                model: 'eleven_turbo_v2_5',
                processing_time_ms: totalTime
              }
            });
        });

      // PHASE 7: DIRECT RESPONSE - Eliminate storage bottleneck
      return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${publicUrl}</Play>
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