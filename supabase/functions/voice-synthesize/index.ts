import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getAuthContext } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Map model names to ElevenLabs model IDs
const MODEL_MAP: Record<string, string> = {
  'eleven_multilingual_v2': 'eleven_multilingual_v2',
  'eleven_turbo_v2': 'eleven_turbo_v2',
  'eleven_turbo_v2_5': 'eleven_turbo_v2_5',
  'default': 'eleven_multilingual_v2'
};

// Retry with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 250
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      console.log(`Attempt ${attempt + 1} failed:`, error);
      
      // Don't retry on auth errors
      if (error instanceof Response && error.status === 401) {
        throw error;
      }
      
      // Retry on 429 (rate limit) and 5xx errors
      if (error instanceof Response && (error.status === 429 || error.status >= 500)) {
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      
      // Don't retry on other 4xx errors
      if (error instanceof Response && error.status >= 400 && error.status < 500) {
        throw error;
      }
      
      // Retry on network errors
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }
  }
  
  throw lastError!;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authContext = await getAuthContext(req);
    const { text, voiceId, model } = await req.json();

    if (!text) {
      throw new Error('Text is required');
    }

    console.log('Voice synthesis request:', { textLength: text.length, voiceId, model });

    const elevenLabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');
    const defaultVoiceId = Deno.env.get('ELEVENLABS_VOICE_ID_DEFAULT') || '9BWtsMINqrJLrRacOk9x';
    
    if (!elevenLabsApiKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    const effectiveVoiceId = voiceId || defaultVoiceId;
    const effectiveModel = MODEL_MAP[model || 'default'] || MODEL_MAP.default;

    console.log(`Synthesizing with ElevenLabs: voice=${effectiveVoiceId}, model=${effectiveModel}`);

    // Make API call with retry logic
    const response = await retryWithBackoff(async () => {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${effectiveVoiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': elevenLabsApiKey,
        },
        body: JSON.stringify({
          text: text,
          model_id: effectiveModel,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
            style: 0.0,
            use_speaker_boost: true
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`ElevenLabs API error: ${response.status} ${errorText}`);
        
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please try again shortly.');
        } else if (response.status === 401) {
          throw new Error('Invalid ElevenLabs API key');
        } else if (response.status >= 500) {
          throw new Error('ElevenLabs service temporarily unavailable');
        } else {
          throw new Error(`Voice synthesis failed: ${errorText}`);
        }
      }

      return response;
    });

    // Get audio data as array buffer
    const audioBuffer = await response.arrayBuffer();
    
    // Convert to base64
    const base64Audio = btoa(
      String.fromCharCode(...new Uint8Array(audioBuffer))
    );

    console.log(`Voice synthesis successful: ${base64Audio.length} bytes encoded`);

    return new Response(
      JSON.stringify({ 
        audioBase64: base64Audio, 
        mime: 'audio/mpeg',
        voiceId: effectiveVoiceId,
        model: effectiveModel
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('Voice synthesis error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});