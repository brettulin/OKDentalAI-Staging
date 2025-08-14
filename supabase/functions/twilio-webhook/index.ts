import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Twilio webhook received:', req.method);
    console.log('Request headers:', Object.fromEntries(req.headers.entries()));
    
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

    console.log('Webhook data received:', webhookData);

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

    console.log('Processing call:', { CallSid, CallStatus, From, To });

    // 1. Find clinic by phone number using phone_numbers table
    const { data: phoneNumber } = await supabase
      .from('phone_numbers')
      .select('clinic_id, e164, twilio_sid')
      .eq('e164', To)
      .eq('status', 'active')
      .single();

    let clinic_id: string | null = null;

    if (phoneNumber) {
      clinic_id = phoneNumber.clinic_id;
      console.log('Found clinic via phone_numbers:', { clinic_id, e164: phoneNumber.e164 });
    } else {
      // Fallback: try clinics.main_phone
      console.log('No phone number found, checking clinics main_phone');
      const { data: clinic } = await supabase
        .from('clinics')
        .select('id, name, main_phone')
        .eq('main_phone', To)
        .single();
      
      if (clinic) {
        clinic_id = clinic.id;
        console.log('Found clinic via main_phone:', { clinic_id, name: clinic.name });
      }
    }

    if (!clinic_id) {
      console.log('No clinic found for phone number:', To);
      console.log('Available phone numbers:', await supabase.from('phone_numbers').select('e164, clinic_id').limit(5));
      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response><Say>Thank you for calling. Please try again later.</Say></Response>', {
        headers: { 'Content-Type': 'text/xml' }
      });
    }

    // 2. Load AI settings for the clinic
    const { data: aiSettings } = await supabase
      .from('ai_settings')
      .select('*')
      .eq('clinic_id', clinic_id)
      .single();

    console.log('AI Settings loaded:', aiSettings);

    // Handle different call statuses
    switch (CallStatus) {
      case 'ringing':
      case 'in-progress':
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

        console.log('Creating/updating call record for:', { CallSid, clinic_id });

        // Build TwiML response using AI settings
        let twimlResponse = '<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n';

        if (aiSettings?.greeting_audio_url) {
          // Use pre-rendered greeting audio
          twimlResponse += `  <Play>${aiSettings.greeting_audio_url}</Play>\n`;
        } else {
          // Fallback to text greeting
          const greeting = aiSettings?.custom_greeting || 'Hello, my name is Clarice from Family Dental, how may I help you?';
          twimlResponse += `  <Say>${greeting}</Say>\n`;
        }

        // Add gather for voice input
        twimlResponse += `  <Gather action="https://zvpezltqpphvolzgfhme.functions.supabase.co/functions/v1/twilio-clarice-voice" method="POST" timeout="8" input="speech" speechTimeout="auto">\n`;
        twimlResponse += `    <Say>Please tell me how I can assist you.</Say>\n`;
        twimlResponse += `  </Gather>\n`;
        twimlResponse += `  <Say>Thank you for calling. Goodbye!</Say>\n`;
        twimlResponse += `  <Hangup/>\n`;
        twimlResponse += `</Response>`;

        console.log('Generated TwiML:', twimlResponse);

        return new Response(twimlResponse, {
          headers: { 'Content-Type': 'text/xml' }
        });

      case 'completed':
      case 'busy':
      case 'failed':
      case 'no-answer':
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
          console.log('Successfully updated call:', CallSid);
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
    console.error('Webhook error:', error);
    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      status: 500,
      headers: { 'Content-Type': 'text/xml' }
    });
  }
});