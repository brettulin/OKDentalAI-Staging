import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getAuthContext } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Process base64 in chunks to prevent memory issues
function processBase64Chunks(base64String: string, chunkSize = 32768) {
  const chunks: Uint8Array[] = [];
  let position = 0;
  
  while (position < base64String.length) {
    const chunk = base64String.slice(position, position + chunkSize);
    const binaryChunk = atob(chunk);
    const bytes = new Uint8Array(binaryChunk.length);
    
    for (let i = 0; i < binaryChunk.length; i++) {
      bytes[i] = binaryChunk.charCodeAt(i);
    }
    
    chunks.push(bytes);
    position += chunkSize;
  }

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

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
    const { audioBase64, mime } = await req.json();
    
    if (!audioBase64) {
      throw new Error('Audio data is required');
    }

    console.log('Voice transcription request:', { mimeType: mime, audioLength: audioBase64.length });

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Process audio in chunks to prevent memory issues
    const binaryAudio = processBase64Chunks(audioBase64);
    
    console.log(`Processing audio: ${binaryAudio.length} bytes`);
    
    // Make API call with retry logic
    const result = await retryWithBackoff(async () => {
      // Prepare form data
      const formData = new FormData();
      const blob = new Blob([binaryAudio], { type: mime || 'audio/webm' });
      formData.append('file', blob, 'audio.webm');
      formData.append('model', 'whisper-1');
      formData.append('language', 'en'); // Default to English
      formData.append('response_format', 'json');

      // Send to OpenAI Whisper
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`OpenAI API error: ${response.status} ${errorText}`);
        
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please try again shortly.');
        } else if (response.status === 401) {
          throw new Error('Invalid OpenAI API key');
        } else if (response.status >= 500) {
          throw new Error('OpenAI service temporarily unavailable');
        } else {
          throw new Error(`Transcription failed: ${errorText}`);
        }
      }

      return await response.json();
    });

    console.log(`Transcription successful: "${result.text}"`);

    return new Response(
      JSON.stringify({ 
        text: result.text || '',
        confidence: 1.0, // OpenAI doesn't return confidence
        language: result.language || 'en'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Voice transcription error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});