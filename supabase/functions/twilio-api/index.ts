import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getAuthContext } from '../_shared/auth.ts';

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
    const authContext = await getAuthContext(req);
    const { action, ...params } = await req.json();

    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
    const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      throw new Error('Twilio credentials not configured');
    }

    const twilioApiUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}`;
    const authHeader = `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    switch (action) {
      case 'make_call':
        const { to, from = TWILIO_PHONE_NUMBER } = params;
        
        if (!to) {
          throw new Error('Phone number required');
        }

        // Create call record
        const { data: call, error: callError } = await supabase
          .from('calls')
          .insert({
            clinic_id: authContext.clinic_id,
            caller_phone: to,
            status: 'initiated',
            started_at: new Date().toISOString()
          })
          .select()
          .single();

        if (callError) {
          throw new Error(`Failed to create call record: ${callError.message}`);
        }

        // Make Twilio API call
        const callData = new URLSearchParams({
          To: to,
          From: from,
          Url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/twilio-webhook`,
          Method: 'POST',
          StatusCallback: `${Deno.env.get('SUPABASE_URL')}/functions/v1/twilio-webhook`,
          StatusCallbackEvent: 'initiated,ringing,answered,completed',
          StatusCallbackMethod: 'POST',
          Record: 'true',
          Transcribe: 'true'
        });

        const callResponse = await fetch(`${twilioApiUrl}/Calls.json`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: callData
        });

        const callResult = await callResponse.json();

        if (!callResponse.ok) {
          throw new Error(`Twilio API error: ${callResult.message}`);
        }

        // Update call with Twilio SID
        await supabase
          .from('calls')
          .update({ twilio_call_sid: callResult.sid })
          .eq('id', call.id);

        return new Response(JSON.stringify({
          success: true,
          call_sid: callResult.sid,
          call_id: call.id
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      case 'hangup_call':
        const { call_sid } = params;
        
        if (!call_sid) {
          throw new Error('Call SID required');
        }

        const hangupResponse = await fetch(`${twilioApiUrl}/Calls/${call_sid}.json`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({ Status: 'completed' })
        });

        const hangupResult = await hangupResponse.json();

        if (!hangupResponse.ok) {
          throw new Error(`Twilio API error: ${hangupResult.message}`);
        }

        return new Response(JSON.stringify({
          success: true,
          message: 'Call ended successfully'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      case 'get_phone_numbers':
        const numbersResponse = await fetch(`${twilioApiUrl}/IncomingPhoneNumbers.json`, {
          headers: { 'Authorization': authHeader }
        });

        const numbersResult = await numbersResponse.json();

        if (!numbersResponse.ok) {
          throw new Error(`Twilio API error: ${numbersResult.message}`);
        }

        return new Response(JSON.stringify({
          success: true,
          phone_numbers: numbersResult.incoming_phone_numbers
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      case 'send_sms':
        const { to: smsTo, body, from: smsFrom = TWILIO_PHONE_NUMBER } = params;
        
        if (!smsTo || !body) {
          throw new Error('Phone number and message body required');
        }

        const smsData = new URLSearchParams({
          To: smsTo,
          From: smsFrom,
          Body: body
        });

        const smsResponse = await fetch(`${twilioApiUrl}/Messages.json`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: smsData
        });

        const smsResult = await smsResponse.json();

        if (!smsResponse.ok) {
          throw new Error(`Twilio API error: ${smsResult.message}`);
        }

        return new Response(JSON.stringify({
          success: true,
          message_sid: smsResult.sid
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error) {
    console.error('Twilio API error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});