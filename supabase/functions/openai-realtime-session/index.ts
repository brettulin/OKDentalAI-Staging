import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

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
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set');
    }

    const { instructions, voice } = await req.json();

    console.log('Creating OpenAI Realtime session with voice:', voice);

    // Request an ephemeral token from OpenAI
    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17",
        voice: voice || "alloy",
        instructions: instructions || `You are a helpful AI dental receptionist assistant. You can:
- Help patients schedule appointments
- Answer basic questions about dental services
- Transfer calls to appropriate staff when needed
- Provide general information about the dental practice

Be friendly, professional, and concise in your responses. If you cannot help with something, offer to transfer the call to a human staff member.`,
        modalities: ["text", "audio"],
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        input_audio_transcription: {
          model: "whisper-1"
        },
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 1000
        },
        tools: [
          {
            type: "function",
            name: "search_appointments",
            description: "Search for available appointment slots",
            parameters: {
              type: "object",
              properties: {
                date: { type: "string", description: "Preferred date (YYYY-MM-DD)" },
                time_preference: { type: "string", description: "morning, afternoon, or evening" },
                service_type: { type: "string", description: "Type of dental service needed" }
              },
              required: ["date"]
            }
          },
          {
            type: "function", 
            name: "transfer_call",
            description: "Transfer the call to a human staff member",
            parameters: {
              type: "object",
              properties: {
                reason: { type: "string", description: "Reason for transfer" },
                department: { type: "string", description: "Specific department if known" }
              },
              required: ["reason"]
            }
          }
        ],
        tool_choice: "auto",
        temperature: 0.7,
        max_response_output_tokens: 1000
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log("Realtime session created successfully");

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error("Error creating realtime session:", error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Failed to create realtime session'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});