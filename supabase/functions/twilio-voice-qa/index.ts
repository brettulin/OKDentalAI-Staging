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
    console.log('=== VOICE QA START ===');
    
    const { clinic_id, dry_run = false } = await req.json();
    
    if (!clinic_id) {
      throw new Error('clinic_id is required');
    }
    
    console.log('QA Parameters:', { clinic_id, dry_run });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get phone number for clinic
    console.log('=== PHONE NUMBER LOOKUP ===');
    const { data: phoneNumber, error: phoneError } = await supabase
      .from('phone_numbers')
      .select('*')
      .eq('clinic_id', clinic_id)
      .eq('status', 'active')
      .single();

    console.log('Phone lookup result:', { phoneNumber, error: phoneError });

    // Get AI settings
    console.log('=== AI SETTINGS LOOKUP ===');
    const { data: aiSettings, error: settingsError } = await supabase
      .from('ai_settings')
      .select('*')
      .eq('clinic_id', clinic_id)
      .single();

    console.log('AI settings result:', { 
      found: !!aiSettings, 
      error: settingsError,
      voice_id: aiSettings?.voice_id,
      has_greeting_audio: !!aiSettings?.greeting_audio_url
    });

    // Get latest call for this clinic
    console.log('=== LATEST CALL LOOKUP ===');
    const { data: latestCall, error: callError } = await supabase
      .from('calls')
      .select('*')
      .eq('clinic_id', clinic_id)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    console.log('Latest call result:', { found: !!latestCall, error: callError });

    // Simulate webhook call to generate TwiML if dry_run is requested
    let twimlResult = 'Dry run not requested';
    let twimlError = null;
    
    if (dry_run && phoneNumber) {
      console.log('=== DRY RUN TWIML GENERATION ===');
      
      try {
        const webhookData = new FormData();
        webhookData.append('CallSid', 'TEST_CALL_SID_' + Date.now());
        webhookData.append('CallStatus', 'ringing');
        webhookData.append('From', '+1234567890');
        webhookData.append('To', phoneNumber.e164);
        webhookData.append('Direction', 'inbound');

        console.log('Calling webhook with test data...');
        
        const webhookResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/twilio-webhook`, {
          method: 'POST',
          body: webhookData,
          headers: {
            'User-Agent': 'TwilioProxy/1.1'
          }
        });

        if (webhookResponse.ok) {
          twimlResult = await webhookResponse.text();
          console.log('✅ Webhook call successful');
        } else {
          const errorText = await webhookResponse.text();
          twimlError = `HTTP ${webhookResponse.status}: ${errorText}`;
          console.error('Webhook call failed:', twimlError);
        }
      } catch (error) {
        twimlError = error.message;
        console.error('Error calling webhook:', error);
      }
    }

    // Analyze TwiML content
    let twimlAnalysis = null;
    if (dry_run && twimlResult && !twimlError) {
      twimlAnalysis = {
        has_play_tag: twimlResult.includes('<Play>'),
        has_say_tag: twimlResult.includes('<Say>'),
        has_gather_tag: twimlResult.includes('<Gather>'),
        has_greeting_audio: twimlResult.includes(aiSettings?.greeting_audio_url || 'NO_AUDIO_URL'),
        length: twimlResult.length
      };
    }

    const qaData = {
      clinic_resolution: {
        clinic_id,
        phone_number: phoneNumber?.e164 || null,
        twilio_sid: phoneNumber?.twilio_sid || null,
        status: phoneNumber ? 'resolved' : 'not_found',
        error: phoneError?.message || null
      },
      ai_settings: {
        found: !!aiSettings,
        voice_provider: aiSettings?.voice_provider,
        voice_id: aiSettings?.voice_id,
        voice_model: aiSettings?.voice_model,
        voice_enabled: aiSettings?.voice_enabled,
        custom_greeting: aiSettings?.custom_greeting,
        greeting_audio_url: aiSettings?.greeting_audio_url,
        has_greeting_audio: !!aiSettings?.greeting_audio_url,
        updated_at: aiSettings?.updated_at,
        error: settingsError?.message || null
      },
      latest_call: latestCall ? {
        call_sid: latestCall.twilio_call_sid,
        status: latestCall.status,
        started_at: latestCall.started_at,
        caller_phone: latestCall.caller_phone,
        duration: latestCall.call_duration_seconds
      } : null,
      twiml_test: {
        requested: dry_run,
        success: dry_run && !twimlError,
        content: dry_run ? twimlResult : 'Not requested',
        error: twimlError,
        analysis: twimlAnalysis
      },
      performance_metrics: {
        phone_lookup_time: phoneError ? null : 'fast',
        settings_lookup_time: settingsError ? null : 'fast',
        expected_latency: aiSettings?.greeting_audio_url ? '<200ms (pre-rendered)' : '1-2s (text synthesis)'
      },
      timestamp: new Date().toISOString()
    };

    console.log('=== QA COMPLETE ===');
    console.log('QA Summary:', {
      clinic_resolved: !!phoneNumber,
      settings_found: !!aiSettings,
      has_greeting_audio: !!aiSettings?.greeting_audio_url,
      twiml_test_success: dry_run && !twimlError
    });

    return new Response(JSON.stringify(qaData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('=== QA ERROR ===');
    console.error('Error details:', error);
    
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});