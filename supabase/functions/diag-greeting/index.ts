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
    const { To } = await req.json();
    
    if (!To) {
      throw new Error('To parameter required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get clinic from phone_numbers table
    const { data: phoneNumber, error: phoneError } = await supabase
      .from('phone_numbers')
      .select('clinic_id, e164')
      .eq('e164', To)
      .eq('status', 'active')
      .single();

    if (phoneError || !phoneNumber) {
      return new Response(JSON.stringify({
        error: 'Phone number not found',
        To,
        clinic_id: null,
        greeting_url: null,
        twiml_preview: null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get AI settings
    const { data: aiSettings } = await supabase
      .from('ai_settings')
      .select('voice_provider, voice_id, custom_greeting, greeting_audio_url, voice_enabled')
      .eq('clinic_id', phoneNumber.clinic_id)
      .single();

    const useGreetingAudio = aiSettings?.greeting_audio_url && aiSettings?.voice_enabled;
    
    let twiml_preview;
    if (useGreetingAudio) {
      twiml_preview = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${aiSettings.greeting_audio_url}</Play>
  <Gather action="https://zvpezltqpphvolzgfhme.functions.supabase.co/functions/v1/twilio-clarice-voice" method="POST" input="speech" speechTimeout="1" timeout="3" actionOnEmptyResult="true" bargeIn="true">
    <Say>Please tell me how I can help.</Say>
  </Gather>
</Response>`;
    } else {
      const greeting = aiSettings?.custom_greeting || 'Hello, my name is Clarice from Family Dental, how may I help you?';
      twiml_preview = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna-Neural">${greeting}</Say>
  <Gather action="https://zvpezltqpphvolzgfhme.functions.supabase.co/functions/v1/twilio-clarice-voice" method="POST" input="speech" speechTimeout="1" timeout="3" actionOnEmptyResult="true" bargeIn="true">
    <Say>Please tell me how I can help.</Say>
  </Gather>
</Response>`;
    }

    const result = {
      clinic_id: phoneNumber.clinic_id,
      number: To,
      greeting_url: aiSettings?.greeting_audio_url || null,
      voice_id: aiSettings?.voice_id,
      voice_enabled: aiSettings?.voice_enabled,
      twiml_preview
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Diag greeting error:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});