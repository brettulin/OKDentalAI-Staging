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

    // Find clinic by phone number - first try exact match in pms_credentials
    let { data: office } = await supabase
      .from('offices')
      .select('clinic_id, name, pms_credentials')
      .eq('pms_credentials->twilio_phone', To)
      .single();

    // If no exact match found, try to find by main phone in clinics table
    if (!office) {
      console.log('No office found with twilio_phone, checking clinics main_phone');
      const { data: clinic } = await supabase
        .from('clinics')
        .select('id, name, main_phone')
        .eq('main_phone', To)
        .single();
      
      if (clinic) {
        // Find the first office for this clinic
        const { data: clinicOffice } = await supabase
          .from('offices')
          .select('clinic_id, name, pms_credentials')
          .eq('clinic_id', clinic.id)
          .limit(1)
          .single();
        
        office = clinicOffice;
        console.log('Found clinic office:', office);
      }
    }

    if (!office?.clinic_id) {
      console.log('No clinic found for phone number:', To);
      console.log('Available offices:', await supabase.from('offices').select('id, name, pms_credentials').limit(5));
      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response><Say>Thank you for calling. Please try again later.</Say></Response>', {
        headers: { 'Content-Type': 'text/xml' }
      });
    }

    const clinic_id = office.clinic_id;

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

        // Generate TwiML for REAL-TIME AI voice with WebSocket (sub-second latency)
        const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://zvpezltqpphvolzgfhme.functions.supabase.co/functions/v1/twilio-realtime-voice" />
  </Connect>
</Response>`;

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