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

  console.log('WebSocket connection attempt');
  const { socket, response } = Deno.upgradeWebSocket(req);
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  let callSid: string | null = null;
  let clinicId: string | null = null;
  let callId: string | null = null;
  let streamSid: string | null = null;
  let clariceVoiceId = 'sIak7pFapfSLCfctxdOu'; // Your custom clarice voice

  socket.onopen = () => {
    console.log('Twilio WebSocket connected successfully');
  };

  socket.onmessage = async (event) => {
    try {
      const message = JSON.parse(event.data);
      console.log('Received from Twilio:', message.event);

      switch (message.event) {
        case 'connected':
          console.log('Twilio media stream connected');
          break;

        case 'start':
          callSid = message.start.callSid;
          streamSid = message.start.streamSid;
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
            console.log('Found clinic:', clinic.name);
            
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
              console.log('Created call record:', callId);
            }

            // Send initial greeting with your clarice voice
            await sendClariceVoiceResponse(
              `Hello! I'm your AI dental assistant at ${clinic.name}. How can I help you today?`,
              streamSid,
              socket
            );
          }
          break;

        case 'media':
          // Process incoming audio and generate AI response
          if (streamSid) {
            await processAudioAndRespond(message.media.payload, streamSid, socket, clinicId, callId);
          }
          break;

        case 'stop':
          console.log('Media stream stopped');
          
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
  };

  // Function to send Clarice voice response
  async function sendClariceVoiceResponse(text: string, streamSid: string, socket: WebSocket) {
    try {
      console.log('Generating Clarice voice for:', text);
      
      // Generate speech with ElevenLabs using your clarice voice
      const ttsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${clariceVoiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': Deno.env.get('ELEVENLABS_API_KEY'),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_turbo_v2_5', // Fastest model
          voice_settings: {
            stability: 0.4,
            similarity_boost: 0.8,
            style: 0.0,
            use_speaker_boost: false
          },
          output_format: "pcm_16000" // PCM format for Twilio
        }),
      });

      if (ttsResponse.ok) {
        const audioBuffer = await ttsResponse.arrayBuffer();
        const audioBytes = new Uint8Array(audioBuffer);
        
        // Convert to base64 and send to Twilio
        const base64Audio = btoa(String.fromCharCode(...audioBytes));
        
        socket.send(JSON.stringify({
          event: 'media',
          streamSid: streamSid,
          media: {
            payload: base64Audio
          }
        }));
        
        console.log('Sent Clarice voice audio to Twilio');
      } else {
        console.error('ElevenLabs TTS error:', await ttsResponse.text());
      }
    } catch (error) {
      console.error('Error generating Clarice voice:', error);
    }
  }

  // Function to process audio and respond
  async function processAudioAndRespond(audioPayload: string, streamSid: string, socket: WebSocket, clinicId: string | null, callId: string | null) {
    try {
      // Transcribe audio using OpenAI Whisper
      const audioData = atob(audioPayload);
      const audioBytes = new Uint8Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        audioBytes[i] = audioData.charCodeAt(i);
      }

      const formData = new FormData();
      formData.append('file', new Blob([audioBytes], { type: 'audio/wav' }), 'audio.wav');
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
        const userText = transcription.text;
        
        if (userText && userText.trim().length > 2) {
          console.log('User said:', userText);
          
          // Store user message
          if (callId) {
            await supabase
              .from('turns')
              .insert({
                call_id: callId,
                role: 'user',
                text: userText
              });
          }

          // Generate AI response
          const aiResponse = await generateAIResponse(userText, clinicId);
          
          // Store AI response
          if (callId) {
            await supabase
              .from('turns')
              .insert({
                call_id: callId,
                role: 'assistant',
                text: aiResponse
              });
          }

          // Send Clarice voice response
          await sendClariceVoiceResponse(aiResponse, streamSid, socket);
        }
      }
    } catch (error) {
      console.error('Error processing audio:', error);
    }
  }

  // Function to generate AI response
  async function generateAIResponse(userText: string, clinicId: string | null): Promise<string> {
    try {
      const { data: clinic } = clinicId ? await supabase
        .from('clinics')
        .select('name')
        .eq('id', clinicId)
        .single() : { data: null };

      const systemPrompt = `You are an AI dental receptionist for ${clinic?.name || 'our dental clinic'}. 
      Respond in exactly 1 sentence. Be direct and helpful.
      Help with: appointments, questions, messages.`;

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
            { role: 'user', content: userText }
          ],
          max_tokens: 50,
          temperature: 0.5,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const aiResponse = data.choices[0]?.message?.content || "How can I help you today?";
        console.log('AI Response:', aiResponse);
        return aiResponse;
      } else {
        console.error('OpenAI API error:', await response.text());
        return "How can I help you today?";
      }
    } catch (error) {
      console.error('Error generating AI response:', error);
      return "How can I help you today?";
    }
  }

  return response;
});