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
    const { clinic_id, dry_run = false } = await req.json();
    console.log('Voice QA request:', { clinic_id, dry_run });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get phone number for clinic
    const { data: phoneNumber } = await supabase
      .from('phone_numbers')
      .select('*')
      .eq('clinic_id', clinic_id)
      .eq('status', 'active')
      .single();

    // Get AI settings
    const { data: aiSettings } = await supabase
      .from('ai_settings')
      .select('*')
      .eq('clinic_id', clinic_id)
      .single();

    // Get latest call for this clinic
    const { data: latestCall } = await supabase
      .from('calls')
      .select('*')
      .eq('clinic_id', clinic_id)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    // Simulate webhook call to generate TwiML
    let twiml = 'No TwiML generated';
    if (dry_run && phoneNumber) {
      const webhookData = new FormData();
      webhookData.append('CallSid', 'TEST_CALL_SID');
      webhookData.append('CallStatus', 'ringing');
      webhookData.append('From', '+1234567890');
      webhookData.append('To', phoneNumber.e164);

      try {
        const webhookResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/twilio-webhook`, {
          method: 'POST',
          body: webhookData
        });

        if (webhookResponse.ok) {
          twiml = await webhookResponse.text();
        }
      } catch (error) {
        console.error('Error calling webhook:', error);
        twiml = `Error: ${error.message}`;
      }
    }

    const qaData = {
      clinic_resolution: {
        clinic_id,
        phone_number: phoneNumber?.e164,
        status: phoneNumber ? 'resolved' : 'not_found'
      },
      ai_settings: {
        voice_provider: aiSettings?.voice_provider,
        voice_id: aiSettings?.voice_id,
        voice_model: aiSettings?.voice_model,
        voice_enabled: aiSettings?.voice_enabled,
        custom_greeting: aiSettings?.custom_greeting,
        greeting_audio_url: aiSettings?.greeting_audio_url,
        updated_at: aiSettings?.updated_at
      },
      latest_call: latestCall ? {
        call_sid: latestCall.twilio_call_sid,
        status: latestCall.status,
        started_at: latestCall.started_at,
        caller_phone: latestCall.caller_phone
      } : null,
      generated_twiml: dry_run ? twiml : 'Dry run not requested'
    };

    console.log('QA Data compiled:', qaData);

    return new Response(JSON.stringify(qaData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in voice QA:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});