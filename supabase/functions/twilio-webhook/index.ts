import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Twilio signature validation (optional, can be disabled for local testing)
function validateTwilioSignature(signature: string, url: string, params: Record<string, string>): boolean {
  // TODO: Implement Twilio signature validation if needed
  // For now, we'll skip validation but log the signature for debugging
  console.log('Twilio signature received:', signature);
  return true; // Allow all requests for now
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== TWILIO WEBHOOK START ===');
    console.log('Method:', req.method);
    console.log('Headers:', Object.fromEntries(req.headers.entries()));
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse form data from Twilio webhook
    const formData = await req.formData();
    const webhookData: Record<string, string> = {};
    
    for (const [key, value] of formData.entries()) {
      webhookData[key] = value.toString();
    }

    console.log('Webhook data:', webhookData);

    const {
      CallSid,
      CallStatus,
      From,
      To,
      Duration,
      RecordingUrl,
      TranscriptionText,
      Direction,
      StartTime,
      EndTime
    } = webhookData;

    console.log('Call details:', { CallSid, CallStatus, From, To });

    // Optional: Validate Twilio signature
    const twilioSignature = req.headers.get('x-twilio-signature');
    if (twilioSignature && !validateTwilioSignature(twilioSignature, req.url, webhookData)) {
      console.warn('Invalid Twilio signature');
      // In production, you might want to reject invalid signatures
      // return new Response('Forbidden', { status: 403 });
    }

    // Step 1: Resolve clinic from phone_numbers table using exact E.164 match
    console.log('=== CLINIC RESOLUTION ===');
    console.log('Looking up phone number:', To);
    
    const { data: phoneNumber, error: phoneError } = await supabase
      .from('phone_numbers')
      .select('clinic_id, e164, twilio_sid, status')
      .eq('e164', To)
      .eq('status', 'active')
      .single();

    if (phoneError || !phoneNumber) {
      console.error('Phone number lookup failed:', phoneError);
      console.log('No active phone number found for:', To);
      
      // Log available phone numbers for debugging
      const { data: allNumbers } = await supabase
        .from('phone_numbers')
        .select('e164, clinic_id, status')
        .limit(10);
      console.log('Available phone numbers:', allNumbers);
      
      // Return fallback TwiML
      const fallbackTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Thanks for calling. Please try again later.</Say>
  <Hangup/>
</Response>`;
      
      return new Response(fallbackTwiML, {
        headers: { 'Content-Type': 'text/xml' }
      });
    }

    const clinic_id = phoneNumber.clinic_id;
    console.log('✅ Clinic resolved:', { clinic_id, e164: phoneNumber.e164 });

    // Step 2: Query AI settings for the resolved clinic
    console.log('=== AI SETTINGS LOOKUP ===');
    const { data: aiSettings, error: settingsError } = await supabase
      .from('ai_settings')
      .select('voice_provider, voice_model, voice_id, language, custom_greeting, greeting_audio_url, voice_enabled')
      .eq('clinic_id', clinic_id)
      .single();

    if (settingsError) {
      console.error('AI settings lookup failed:', settingsError);
    }

    console.log('AI Settings loaded:', {
      voice_provider: aiSettings?.voice_provider,
      voice_id: aiSettings?.voice_id,
      voice_enabled: aiSettings?.voice_enabled,
      has_greeting_audio: !!aiSettings?.greeting_audio_url,
      custom_greeting_length: aiSettings?.custom_greeting?.length || 0
    });

    // Handle different call statuses
    switch (CallStatus) {
      case 'ringing':
      case 'in-progress':
        console.log('=== CALL PROCESSING ===');
        
        // Create or update call record
        const { error: upsertError } = await supabase
          .from('calls')
          .upsert({
            twilio_call_sid: CallSid,
            clinic_id,
            caller_phone: From,
            status: CallStatus === 'ringing' ? 'incoming' : 'in_progress',
            started_at: StartTime ? new Date(StartTime) : new Date(),
          });

        if (upsertError) {
          console.error('Error upserting call:', upsertError);
        }

        console.log('Call record created/updated for:', { CallSid, clinic_id });

        // Step 3: Build optimized TwiML response
        console.log('=== TWIML GENERATION ===');
        let twimlResponse;

        const useGreetingAudio = aiSettings?.greeting_audio_url && aiSettings?.voice_enabled;
        
        if (useGreetingAudio) {
          // Use pre-rendered greeting audio - NO extra <Say> elements
          twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${aiSettings.greeting_audio_url}</Play>
  <Gather action="https://zvpezltqpphvolzgfhme.functions.supabase.co/functions/v1/twilio-clarice-voice" method="POST" input="speech" speechTimeout="1" timeout="3" actionOnEmptyResult="true" bargeIn="true">
    <Say>Please tell me how I can help.</Say>
  </Gather>
</Response>`;
        } else {
          // Fallback to text greeting with Polly voice
          const greeting = aiSettings?.custom_greeting || 'Hello, my name is Clarice from Family Dental, how may I help you?';
          twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna-Neural">${greeting}</Say>
  <Gather action="https://zvpezltqpphvolzgfhme.functions.supabase.co/functions/v1/twilio-clarice-voice" method="POST" input="speech" speechTimeout="1" timeout="3" actionOnEmptyResult="true" bargeIn="true">
    <Say>Please tell me how I can help.</Say>
  </Gather>
</Response>`;
        }

        // Log final TwiML and key metrics
        console.log(JSON.stringify({
          tag: "twilio-webhook:twiml",
          clinic_id,
          used_greeting: useGreetingAudio ? "play" : "say",
          greeting_url: useGreetingAudio ? aiSettings.greeting_audio_url : null,
          url: req.url
        }));

        return new Response(twimlResponse, {
          headers: { 'Content-Type': 'text/xml' }
        });

      case 'completed':
      case 'busy':
      case 'failed':
      case 'no-answer':
        console.log('=== CALL COMPLETION ===');
        
        // Update call with final status and duration
        const { error: updateError } = await supabase
          .from('calls')
          .update({
            status: CallStatus,
            ended_at: EndTime ? new Date(EndTime) : new Date(),
            call_duration_seconds: Duration ? parseInt(Duration) : null,
            outcome: CallStatus === 'completed' ? 'completed' : 'missed'
          })
          .eq('twilio_call_sid', CallSid);

        if (updateError) {
          console.error('Error updating call:', updateError);
        } else {
          console.log('✅ Call updated successfully:', CallSid);
        }

        // Log call event
        await supabase
          .from('call_events')
          .insert({
            call_id: (await supabase
              .from('calls')
              .select('id')
              .eq('twilio_call_sid', CallSid)
              .single()
            ).data?.id,
            event_type: 'call_ended',
            event_data: {
              status: CallStatus,
              duration: Duration,
              recording_url: RecordingUrl
            }
          });

        break;

      case 'recording':
        console.log('=== RECORDING PROCESSING ===');
        
        // Handle recording completion
        if (RecordingUrl) {
          const { data: call } = await supabase
            .from('calls')
            .select('id')
            .eq('twilio_call_sid', CallSid)
            .single();

          if (call) {
            await supabase
              .from('call_events')
              .insert({
                call_id: call.id,
                event_type: 'recording_available',
                event_data: {
                  recording_url: RecordingUrl,
                  transcription: TranscriptionText
                }
              });
          }
        }
        break;
    }

    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: { 'Content-Type': 'text/xml' }
    });

  } catch (error) {
    console.error('=== WEBHOOK ERROR ===');
    console.error('Error details:', error);
    
    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response><Say>Service temporarily unavailable. Please try again later.</Say></Response>', {
      status: 500,
      headers: { 'Content-Type': 'text/xml' }
    });
  }
});