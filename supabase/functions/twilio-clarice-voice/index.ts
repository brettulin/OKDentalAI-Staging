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

    // Get clinic_id from phone_numbers (minimal DB read)
    const { data: phoneNumber } = await supabase
      .from('phone_numbers')
      .select('clinic_id')
      .eq('e164', To)
      .eq('status', 'active')
      .single();

    if (!phoneNumber) {
      console.error('No active phone number found for:', To);
      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response><Say>Service unavailable.</Say><Hangup/></Response>', {
        headers: { 'Content-Type': 'text/xml' }
      });
    }

    // Get voice_id from ai_settings
    const { data: aiSettings } = await supabase
      .from('ai_settings')
      .select('voice_id')
      .eq('clinic_id', phoneNumber.clinic_id)
      .single();

    const userMessage = SpeechResult || "Hello, I'd like to schedule an appointment.";
    
    // Generate SHORT AI response (< 100 tokens)
    const systemPrompt = `You are Clarice, dental receptionist. Reply in 1 short sentence.`;

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
        max_tokens: 30,
        temperature: 0.5,
      }),
    });

    let aiResponse = "How can I help you today?";
    
    if (response.ok) {
      const data = await response.json();
      aiResponse = data.choices[0]?.message?.content || aiResponse;
    }

    // Use voice_id from settings, fallback to Clarice
    const voiceId = aiSettings?.voice_id || 'sIak7pFapfSLCfctxdOu';

    // ElevenLabs synthesis with eleven_turbo_v2
    const ttsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': Deno.env.get('ELEVENLABS_API_KEY'),
        'content-type': 'application/json',
        'accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text: aiResponse,
        model_id: 'eleven_turbo_v2',
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
      const sessionFileName = `audio/sessions/${CallSid}/${Date.now()}.mp3`;
      
      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('audio')
        .upload(sessionFileName, new Uint8Array(audioBuffer), {
          contentType: 'audio/mpeg',
          upsert: true
        });

      if (uploadError) {
        throw new Error('Failed to upload audio');
      }

      const { data: { publicUrl } } = supabase.storage
        .from('audio')
        .getPublicUrl(sessionFileName);

      const t2 = Date.now(); // upload_done

      // Log timing
      console.log(JSON.stringify({
        tag: "twilio-clarice-voice:timing",
        CallSid, 
        tts_ms: t1-t0, 
        upload_ms: t2-t1, 
        total_ms: t2-t0
      }));

      // Return TwiML with Play (NO base64)
      return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${publicUrl}</Play>
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