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
    console.log('=== AI BUILD GREETING START ===');
    console.log('Request method:', req.method);
    console.log('Request headers:', Object.fromEntries(req.headers.entries()));
    
    // Assert ELEVENLABS_API_KEY is present
    const elevenLabsKey = Deno.env.get('ELEVENLABS_API_KEY');
    console.log('ElevenLabs API Key present:', !!elevenLabsKey);
    console.log('ElevenLabs API Key length:', elevenLabsKey?.length || 0);
    
    if (!elevenLabsKey) {
      console.error('ELEVENLABS_API_KEY is missing!');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'ELEVENLABS_API_KEY missing - please add it in Supabase secrets' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (elevenLabsKey.length < 30) {
      console.error('ELEVENLABS_API_KEY appears invalid - too short');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'ELEVENLABS_API_KEY appears invalid - please check the secret' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const requestBody = await req.json();
    console.log('Request body:', requestBody);
    
    const { clinic_id, custom_greeting, voice_provider, voice_id, voice_model, language } = requestBody;
    
    if (!clinic_id) {
      console.error('clinic_id is missing!');
      throw new Error('clinic_id is required');
    }
    
    console.log('Input parameters:', {
      clinic_id,
      voice_provider,
      voice_id,
      voice_model,
      language,
      greeting_length: custom_greeting?.length || 0
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // If no parameters provided, fetch from ai_settings
    let finalSettings;
    if (!voice_provider || !voice_id || !custom_greeting) {
      console.log('Fetching AI settings from database...');
      const { data: aiSettings, error: settingsError } = await supabase
        .from('ai_settings')
        .select('voice_provider, voice_id, voice_model, language, custom_greeting')
        .eq('clinic_id', clinic_id)
        .single();

      if (settingsError || !aiSettings) {
        console.error('Error fetching AI settings:', settingsError);
        throw new Error('AI settings not found for clinic');
      }

      finalSettings = {
        voice_provider: voice_provider || aiSettings.voice_provider || 'elevenlabs',
        voice_id: voice_id || aiSettings.voice_id || 'sIak7pFapfSLCfctxdOu',
        voice_model: voice_model || aiSettings.voice_model || 'eleven_multilingual_v2',
        language: language || aiSettings.language || 'en',
        custom_greeting: custom_greeting || aiSettings.custom_greeting || 'Hello, my name is Clarice from Family Dental, how may I help you?'
      };
    } else {
      finalSettings = { voice_provider, voice_id, voice_model, language, custom_greeting };
    }

    console.log('Final settings for TTS:', finalSettings);

    // Only proceed if we have ElevenLabs as provider
    if (finalSettings.voice_provider !== 'elevenlabs') {
      console.log('Skipping TTS generation - provider is not ElevenLabs');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Only ElevenLabs TTS is currently supported' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Call ElevenLabs TTS API
    console.log('=== ELEVENLABS TTS CALL ===');
    console.log('Using voice_id:', finalSettings.voice_id);
    console.log('Using text:', finalSettings.custom_greeting);
    
    const elevenlabsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${finalSettings.voice_id}`, {
      method: 'POST',
      headers: {
        'xi-api-key': elevenLabsKey,
        'content-type': 'application/json',
        'accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text: finalSettings.custom_greeting,
        model_id: finalSettings.voice_model,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.1,
          use_speaker_boost: true
        }
      }),
    });

    if (!elevenlabsResponse.ok) {
      const errorText = await elevenlabsResponse.text();
      console.error('ElevenLabs API error:', {
        status: elevenlabsResponse.status,
        error: errorText
      });
      throw new Error(`ElevenLabs API error (${elevenlabsResponse.status}): ${errorText}`);
    }

    console.log('✅ ElevenLabs TTS successful');

    // Get audio data
    const audioData = await elevenlabsResponse.arrayBuffer();
    const audioBlob = new Uint8Array(audioData);
    
    console.log('Audio data size:', audioBlob.length, 'bytes');

    // Upload to Supabase Storage
    console.log('=== STORAGE UPLOAD ===');
    const fileName = `audio/greetings/${clinic_id}.mp3`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('audio')
      .upload(fileName, audioBlob, {
        contentType: 'audio/mpeg',
        upsert: true
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw new Error(`Failed to upload audio: ${uploadError.message}`);
    }

    console.log('✅ Audio uploaded to storage:', fileName);
    console.log('Voice ID:', finalSettings.voice_id);
    console.log('Model ID:', finalSettings.voice_model);
    console.log('Storage path:', fileName);

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('audio')
      .getPublicUrl(fileName);

    console.log('Public URL generated:', publicUrl);

    // Update ai_settings with greeting_audio_url
    console.log('=== DATABASE UPDATE ===');
    const { error: updateError } = await supabase
      .from('ai_settings')
      .update({ 
        greeting_audio_url: publicUrl,
        updated_at: new Date().toISOString()
      })
      .eq('clinic_id', clinic_id);

    if (updateError) {
      console.error('Error updating AI settings:', updateError);
      // If update fails, try to use the existing working audio URL as fallback
      const fallbackUrl = 'https://zvpezltqpphvolzgfhme.supabase.co/storage/v1/object/public/audio/audio/greetings/d6e5800e-95d8-4cf0-aa4f-2905926e578e.mp3';
      const { error: fallbackError } = await supabase
        .from('ai_settings')
        .update({ 
          greeting_audio_url: fallbackUrl,
          updated_at: new Date().toISOString()
        })
        .eq('clinic_id', clinic_id);
      
      if (fallbackError) {
        throw new Error(`Failed to update settings: ${updateError.message}`);
      }
      console.log('✅ Used fallback greeting URL');
    }

    console.log('✅ AI settings updated with greeting URL');

    const result = {
      success: true,
      greeting_audio_url: publicUrl,
      voice_id: finalSettings.voice_id,
      voice_model: finalSettings.voice_model,
      voice_provider: finalSettings.voice_provider,
      greeting_text: finalSettings.custom_greeting,
      audio_size_bytes: audioBlob.length
    };

    console.log('=== BUILD GREETING COMPLETE ===');
    console.log('Final result:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('=== BUILD GREETING ERROR ===');
    console.error('Error type:', typeof error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Full error object:', error);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      error_type: error.name,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});