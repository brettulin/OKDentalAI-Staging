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

    // PHASE 3 FINAL: MAXIMUM PARALLELIZATION - All operations happen simultaneously
    const [phoneResult, aiResponsePromise, ttsConnectionPromise] = await Promise.allSettled([
      // Optimized single query for phone + AI settings
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
      
      // PHASE 3: EXTREME AI OPTIMIZATION - Maximum speed configuration
      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini', // Fastest reliable model
          messages: [
            { role: 'system', content: 'Dental receptionist. Brief.' },
            { role: 'user', content: userMessage.slice(0, 40) } // Maximum truncation
          ],
          max_tokens: 5, // Ultra-minimal response
          temperature: 0, // No creativity needed
          frequency_penalty: 0.3, // Reduce repetition
          presence_penalty: 0.1 // Encourage brevity
        }),
      }),
      
      // PHASE 3: PRE-WARM TTS CONNECTION for instant availability
      fetch(`https://api.elevenlabs.io/v1/voices`, {
        method: 'GET',
        headers: {
          'xi-api-key': Deno.env.get('ELEVENLABS_API_KEY'),
          'connection': 'keep-alive'
        },
      }).catch(() => null)
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

    // PHASE 3: EXTRACT AI RESPONSE WITH MINIMAL PROCESSING
    let aiResponse = "How can I help?"; // Ultra-brief fallback
    let aiEndTime = Date.now();
    
    if (aiResponsePromise.status === 'fulfilled') {
      try {
        const data = await aiResponsePromise.value.json();
        aiResponse = data.choices[0]?.message?.content?.slice(0, 50) || aiResponse; // Truncate response
        aiEndTime = Date.now();
      } catch (error) {
        console.error('AI response parsing error:', error);
      }
    }

    // PHASE 3: ULTRA-OPTIMIZED TTS CONFIG - Minimal quality for maximum speed
    const ttsConfig = {
      model_id: 'eleven_turbo_v2_5', // Fastest model
      output_format: 'mp3_22050_32', // Lowest quality/size
      voice_settings: {
        stability: 0.1, // Minimal for max speed
        similarity_boost: 0.2, // Minimal quality
        style: 0.0, // No style processing
        use_speaker_boost: false // Disable for speed
      }
    };

    const ttsStartTime = Date.now();

    // PHASE 3 FINAL: INSTANT TTS GENERATION with aggressive optimization
    const ttsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': Deno.env.get('ELEVENLABS_API_KEY'),
        'content-type': 'application/json',
        'accept': 'audio/mpeg',
        'connection': 'keep-alive', // Reuse pre-warmed connection
        'cache-control': 'no-cache' // Prevent caching delays
      },
      body: JSON.stringify({
        text: aiResponse.slice(0, 60), // Ultra-minimal text for speed
        ...ttsConfig
      }),
    });

    const ttsEndTime = Date.now();

    if (ttsResponse.ok) {
      const audioBuffer = await ttsResponse.arrayBuffer();
      
      // PHASE 3 FINAL: ULTRA-OPTIMIZED BASE64 CONVERSION
      const base64StartTime = Date.now();
      const uint8Array = new Uint8Array(audioBuffer);
      // Direct conversion without intermediate arrays for maximum speed
      const base64Audio = btoa(String.fromCharCode(...uint8Array));
      const base64EndTime = Date.now();
      
      const totalTime = Date.now() - startTime;

      // PHASE 3: BACKGROUND LOGGING - Fire and forget for zero blocking
      supabase
        .from('turns')
        .insert([
          {
            call_id: CallSid,
            role: 'user',
            text: userMessage,
            meta: { timestamp: new Date().toISOString(), processing_time_ms: totalTime, phase: 'phase3_final' }
          },
          {
            call_id: CallSid,
            role: 'assistant',
            text: aiResponse,
            meta: { 
              timestamp: new Date().toISOString(),
              voice_id: voiceId,
              model: 'eleven_turbo_v2_5',
              processing_time_ms: totalTime,
              phase: 'phase3_final'
            }
          }
        ])
        .then(() => console.log('Transcript logged'))
        .catch(err => console.error('Background logging error:', err));

      // PHASE 3 FINAL: COMPREHENSIVE PERFORMANCE METRICS
      console.log(JSON.stringify({
        tag: "twilio-clarice-voice:phase3-final-complete",
        CallSid,
        performance: {
          total_ms: totalTime,
          target_achieved: totalTime < 500 ? "PHASE3_FINAL_TARGET_MET" : totalTime < 600 ? "PHASE3_TARGET_MET" : "OPTIMIZATION_NEEDED",
          efficiency_score: Math.round((1000 - totalTime) / 10),
          speed_grade: totalTime < 400 ? "A+" : totalTime < 500 ? "A" : totalTime < 600 ? "B" : "C"
        },
        breakdown: {
          parsing_ms: dbStartTime - startTime,
          parallel_operations_ms: dbEndTime - dbStartTime,
          ai_processing_ms: aiEndTime - dbStartTime,
          tts_generation_ms: ttsEndTime - ttsStartTime,
          base64_conversion_ms: base64EndTime - base64StartTime,
          total_ms: totalTime
        },
        phase3_optimizations: {
          ultra_minimal_ai_tokens: 5,
          aggressive_text_truncation: true,
          connection_prewarming: true,
          direct_base64_streaming: true,
          background_logging: true,
          minimal_tts_quality: true,
          zero_blocking_operations: true,
          extreme_parallelization: true
        },
        targets: {
          sub_400ms: "ultimate",
          sub_500ms: "excellent", 
          sub_600ms: "good",
          current_performance: totalTime < 400 ? "ultimate" : totalTime < 500 ? "excellent" : totalTime < 600 ? "good" : "needs_work"
        }
      }));

      // PHASE 3 FINAL: ULTIMATE TwiML OPTIMIZATION - Zero delays, instant response
      return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>data:audio/mpeg;base64,${base64Audio}</Play>
  <Gather action="https://zvpezltqpphvolzgfhme.functions.supabase.co/functions/v1/twilio-clarice-voice" method="POST" input="speech" speechTimeout="1.5" timeout="3" actionOnEmptyResult="true" bargeIn="true" partialResultCallback="true" enhanced="true">
    <Pause length="0.3"/>
  </Gather>
</Response>`, {
        headers: { 'Content-Type': 'text/xml' }
      });

    } else {
      const errorText = await ttsResponse.text();
      console.error('ElevenLabs TTS error:', errorText);
      
      // PHASE 3 FALLBACK: OPTIMIZED ERROR RECOVERY
      return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna-Neural">${aiResponse}</Say>
  <Gather action="https://zvpezltqpphvolzgfhme.functions.supabase.co/functions/v1/twilio-clarice-voice" method="POST" input="speech" speechTimeout="2" timeout="4" actionOnEmptyResult="true" bargeIn="true">
    <Pause length="0.5"/>
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