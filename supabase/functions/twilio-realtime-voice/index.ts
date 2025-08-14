import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  let callSid: string | null = null;
  let clinicId: string | null = null;
  let callId: string | null = null;
  let openaiWs: WebSocket | null = null;

  socket.onopen = () => {
    console.log('Twilio WebSocket connected');
  };

  socket.onmessage = async (event) => {
    try {
      const message = JSON.parse(event.data);
      console.log('Received from Twilio:', message);

      switch (message.event) {
        case 'connected':
          console.log('Twilio media stream connected');
          break;

        case 'start':
          callSid = message.start.callSid;
          const fromNumber = message.start.customParameters?.From;
          const toNumber = message.start.customParameters?.To;
          
          console.log('Call started:', { callSid, fromNumber, toNumber });

          // Find clinic and create call record
          const { data: clinic } = await supabase
            .from('clinics')
            .select('id, name')
            .eq('main_phone', toNumber)
            .single();

          if (clinic) {
            clinicId = clinic.id;
            
            // Create call record
            const { data: call } = await supabase
              .from('calls')
              .insert({
                twilio_call_sid: callSid,
                clinic_id: clinicId,
                caller_phone: fromNumber,
                status: 'in-progress'
              })
              .select()
              .single();
              
            if (call) {
              callId = call.id;
            }

            // Get AI settings for voice
            const { data: aiSettings } = await supabase
              .from('ai_settings')
              .select('*')
              .eq('clinic_id', clinicId)
              .single();

            // Connect to OpenAI Realtime API
            openaiWs = new WebSocket("wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17", {
              headers: {
                "Authorization": `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
                "OpenAI-Beta": "realtime=v1"
              }
            });

            openaiWs.onopen = () => {
              console.log('Connected to OpenAI Realtime API');
              
              // Configure session for dental assistant
              openaiWs?.send(JSON.stringify({
                type: "session.update",
                session: {
                  modalities: ["text", "audio"],
                  instructions: `You are a helpful AI dental receptionist for ${clinic.name}. Keep responses very brief (1 sentence). Help with appointments, questions, and messages. Be friendly and efficient.`,
                  voice: "alloy",
                  input_audio_format: "pcm16",
                  output_audio_format: "pcm16",
                  input_audio_transcription: {
                    model: "whisper-1"
                  },
                  turn_detection: {
                    type: "server_vad",
                    threshold: 0.5,
                    prefix_padding_ms: 300,
                    silence_duration_ms: 500
                  },
                  temperature: 0.6,
                  max_response_output_tokens: 150
                }
              }));
            };

            openaiWs.onmessage = async (event) => {
              const data = JSON.parse(event.data);
              console.log('OpenAI message:', data.type);

              if (data.type === 'response.audio.delta') {
                // Convert PCM to mu-law for Twilio
                const pcmData = atob(data.delta);
                const audioBytes = new Uint8Array(pcmData.length);
                for (let i = 0; i < pcmData.length; i++) {
                  audioBytes[i] = pcmData.charCodeAt(i);
                }

                // Send audio to Twilio
                socket.send(JSON.stringify({
                  event: 'media',
                  streamSid: message.start.streamSid,
                  media: {
                    payload: btoa(String.fromCharCode(...audioBytes))
                  }
                }));
              }

              if (data.type === 'response.audio_transcript.done') {
                console.log('AI said:', data.transcript);
                
                // Store in database
                if (callId) {
                  await supabase
                    .from('turns')
                    .insert({
                      call_id: callId,
                      role: 'assistant',
                      text: data.transcript
                    });
                }
              }

              if (data.type === 'conversation.item.input_audio_transcription.completed') {
                console.log('User said:', data.transcript);
                
                // Store in database
                if (callId) {
                  await supabase
                    .from('turns')
                    .insert({
                      call_id: callId,
                      role: 'user',
                      text: data.transcript
                    });
                }
              }
            };
          }
          break;

        case 'media':
          // Forward audio to OpenAI
          if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
            openaiWs.send(JSON.stringify({
              type: "input_audio_buffer.append",
              audio: message.media.payload
            }));
          }
          break;

        case 'stop':
          console.log('Media stream stopped');
          if (openaiWs) {
            openaiWs.close();
          }
          
          // Update call status
          if (callId) {
            await supabase
              .from('calls')
              .update({
                status: 'completed',
                ended_at: new Date()
              })
              .eq('id', callId);
          }
          break;
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  };

  socket.onclose = () => {
    console.log('Twilio WebSocket disconnected');
    if (openaiWs) {
      openaiWs.close();
    }
  };

  return response;
});