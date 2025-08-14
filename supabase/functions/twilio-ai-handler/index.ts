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
    console.log('Twilio AI Handler received:', req.method);
    
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

    console.log('Webhook data:', webhookData);

    const {
      CallSid,
      RecordingUrl,
      From,
      To,
      TranscriptionText
    } = webhookData;

    if (!CallSid) {
      throw new Error('No CallSid provided');
    }

    // Get call record to find clinic context
    const { data: call } = await supabase
      .from('calls')
      .select('id, clinic_id, caller_phone')
      .eq('twilio_call_sid', CallSid)
      .single();

    if (!call) {
      console.error('Call not found:', CallSid);
      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response><Say>I apologize, but I cannot process your request right now.</Say><Hangup/></Response>', {
        headers: { 'Content-Type': 'text/xml' }
      });
    }

    // Get clinic info and AI settings
    const { data: clinic } = await supabase
      .from('clinics')
      .select('name, main_phone')
      .eq('id', call.clinic_id)
      .single();

    const { data: aiSettings } = await supabase
      .from('ai_settings')
      .select('*')
      .eq('clinic_id', call.clinic_id)
      .single();

    let userMessage = TranscriptionText || "Hello, I'd like to schedule an appointment.";
    
    // If we have a recording but no transcription, transcribe it
    if (RecordingUrl && !TranscriptionText) {
      try {
        // Download and transcribe the recording
        const recordingResponse = await fetch(RecordingUrl);
        const audioBuffer = await recordingResponse.arrayBuffer();
        
        const formData = new FormData();
        formData.append('file', new Blob([audioBuffer], { type: 'audio/wav' }), 'recording.wav');
        formData.append('model', 'whisper-1');

        const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
          },
          body: formData,
        });

        if (transcriptionResponse.ok) {
          const transcription = await transcriptionResponse.json();
          userMessage = transcription.text || userMessage;
          console.log('Transcribed audio:', userMessage);
        }
      } catch (error) {
        console.error('Transcription error:', error);
      }
    }

    // Generate AI response
    const systemPrompt = `You are a helpful AI dental receptionist for ${clinic?.name || 'our dental clinic'}. 
    Help patients with:
    - Scheduling appointments 
    - Answering questions about services
    - Providing clinic information
    - Taking messages for the staff
    
    Keep responses brief and professional. If you need to schedule an appointment, ask for:
    - Preferred date and time
    - Type of service needed
    - Contact information
    
    Always end by asking if there's anything else you can help with.`;

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
        max_tokens: 150,
        temperature: 0.7,
      }),
    });

    let aiResponse = "Thank you for calling. A staff member will get back to you soon.";
    
    if (response.ok) {
      const data = await response.json();
      aiResponse = data.choices[0]?.message?.content || aiResponse;
      console.log('AI Response:', aiResponse);
    } else {
      console.error('OpenAI API error:', await response.text());
    }

    // Store the conversation
    await supabase
      .from('turns')
      .insert([
        {
          call_id: call.id,
          role: 'user',
          text: userMessage,
        },
        {
          call_id: call.id,
          role: 'assistant',
          text: aiResponse,
        }
      ]);

    // Return TwiML with AI response and option to continue
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${aiResponse}</Say>
  <Gather action="https://zvpezltqpphvolzgfhme.functions.supabase.co/twilio-ai-handler" method="POST" timeout="10" finishOnKey="#" input="speech" speechTimeout="auto">
    <Say>Please let me know if you need anything else, or press pound if you're finished.</Say>
  </Gather>
  <Say>Thank you for calling. Have a great day! Goodbye.</Say>
  <Hangup/>
</Response>`;

    return new Response(twimlResponse, {
      headers: { 'Content-Type': 'text/xml' }
    });

  } catch (error) {
    console.error('Twilio AI Handler error:', error);
    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response><Say>I apologize for the technical difficulty. Please call back later.</Say><Hangup/></Response>', {
      status: 500,
      headers: { 'Content-Type': 'text/xml' }
    });
  }
});