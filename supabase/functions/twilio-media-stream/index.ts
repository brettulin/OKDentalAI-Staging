import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

  let callSid: string;
  let clinicId: string;
  let openAISocket: WebSocket | null = null;
  let audioBuffer: string[] = [];

  socket.onopen = () => {
    console.log('Twilio Media Stream connected');
  };

  socket.onmessage = async (event) => {
    try {
      const message = JSON.parse(event.data);
      console.log('Received message type:', message.event);

      switch (message.event) {
        case 'connected':
          console.log('Twilio stream connected');
          break;

        case 'start':
          callSid = message.start.callSid;
          clinicId = message.start.customParameters?.clinicId;
          
          console.log('Call started:', { callSid, clinicId });

          // Get clinic AI settings
          const { data: aiSettings } = await supabase
            .from('ai_settings')
            .select('*')
            .eq('clinic_id', clinicId)
            .single();

          // Initialize OpenAI Realtime connection
          openAISocket = new WebSocket(
            `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`,
            [],
            {
              headers: {
                "Authorization": `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
                "OpenAI-Beta": "realtime=v1"
              }
            }
          );

          openAISocket.onopen = () => {
            console.log('OpenAI Realtime connected');
            
            // Configure session
            openAISocket?.send(JSON.stringify({
              type: 'session.update',
              session: {
                modalities: ['text', 'audio'],
                instructions: `You are an AI receptionist for a dental clinic. Be helpful, professional, and friendly. You can help with appointment scheduling, general inquiries, and basic information. Always be polite and ask for clarification when needed.`,
                voice: aiSettings?.voice_id || 'alloy',
                input_audio_format: 'g711_ulaw',
                output_audio_format: 'g711_ulaw',
                input_audio_transcription: { model: 'whisper-1' },
                turn_detection: {
                  type: 'server_vad',
                  threshold: 0.5,
                  prefix_padding_ms: 300,
                  silence_duration_ms: 1000
                },
                tools: [
                  {
                    type: 'function',
                    name: 'schedule_appointment',
                    description: 'Schedule an appointment for the patient',
                    parameters: {
                      type: 'object',
                      properties: {
                        patient_name: { type: 'string' },
                        phone: { type: 'string' },
                        preferred_date: { type: 'string' },
                        service_type: { type: 'string' }
                      },
                      required: ['patient_name', 'phone']
                    }
                  }
                ],
                tool_choice: 'auto'
              }
            }));
          };

          openAISocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log('OpenAI message:', data.type);

            switch (data.type) {
              case 'response.audio.delta':
                // Forward audio to Twilio
                socket.send(JSON.stringify({
                  event: 'media',
                  streamSid: message.start.streamSid,
                  media: {
                    payload: data.delta
                  }
                }));
                break;

              case 'response.function_call_arguments.done':
                // Handle function calls (e.g., appointment scheduling)
                handleFunctionCall(data, callSid, clinicId, supabase);
                break;

              case 'conversation.item.input_audio_transcription.completed':
                // Store transcript
                storeTranscript(data, callSid, 'user', supabase);
                break;

              case 'response.audio_transcript.delta':
                // Store AI transcript
                storeTranscript(data, callSid, 'assistant', supabase);
                break;
            }
          };

          openAISocket.onerror = (error) => {
            console.error('OpenAI WebSocket error:', error);
          };

          break;

        case 'media':
          // Forward audio to OpenAI
          if (openAISocket?.readyState === WebSocket.OPEN) {
            openAISocket.send(JSON.stringify({
              type: 'input_audio_buffer.append',
              audio: message.media.payload
            }));
          }
          break;

        case 'stop':
          console.log('Call ended');
          openAISocket?.close();
          break;
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  };

  socket.onclose = () => {
    console.log('Twilio Media Stream disconnected');
    openAISocket?.close();
  };

  return response;
});

async function handleFunctionCall(data: any, callSid: string, clinicId: string, supabase: any) {
  const { name, arguments: args } = data;
  
  if (name === 'schedule_appointment') {
    try {
      const { patient_name, phone, preferred_date, service_type } = JSON.parse(args);
      
      // Create or find patient
      let { data: patient } = await supabase
        .from('patients')
        .select('id')
        .eq('phone', phone)
        .eq('clinic_id', clinicId)
        .single();

      if (!patient) {
        const { data: newPatient } = await supabase
          .from('patients')
          .insert({
            full_name: patient_name,
            phone,
            clinic_id: clinicId,
            source: 'ai_call'
          })
          .select('id')
          .single();
        
        patient = newPatient;
      }

      // Log appointment request
      await supabase
        .from('call_events')
        .insert({
          call_id: (await supabase
            .from('calls')
            .select('id')
            .eq('twilio_call_sid', callSid)
            .single()
          ).data?.id,
          event_type: 'appointment_requested',
          event_data: {
            patient_id: patient?.id,
            patient_name,
            phone,
            preferred_date,
            service_type
          }
        });

      console.log('Appointment request logged for:', patient_name);
    } catch (error) {
      console.error('Error handling appointment scheduling:', error);
    }
  }
}

async function storeTranscript(data: any, callSid: string, role: string, supabase: any) {
  try {
    const { data: call } = await supabase
      .from('calls')
      .select('id, transcript_json')
      .eq('twilio_call_sid', callSid)
      .single();

    if (call) {
      const transcript = call.transcript_json || [];
      
      if (data.type === 'conversation.item.input_audio_transcription.completed') {
        transcript.push({
          role: 'user',
          content: data.transcript,
          timestamp: new Date().toISOString()
        });
      } else if (data.type === 'response.audio_transcript.delta') {
        // Find or create assistant message
        const lastMessage = transcript[transcript.length - 1];
        if (lastMessage?.role === 'assistant') {
          lastMessage.content += data.delta;
        } else {
          transcript.push({
            role: 'assistant',
            content: data.delta,
            timestamp: new Date().toISOString()
          });
        }
      }

      await supabase
        .from('calls')
        .update({ transcript_json: transcript })
        .eq('id', call.id);
    }
  } catch (error) {
    console.error('Error storing transcript:', error);
  }
}