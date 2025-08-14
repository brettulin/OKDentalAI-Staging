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
    const { clinic_id } = await req.json();
    console.log('Building greeting for clinic:', clinic_id);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get AI settings for the clinic
    const { data: aiSettings, error: settingsError } = await supabase
      .from('ai_settings')
      .select('*')
      .eq('clinic_id', clinic_id)
      .single();

    if (settingsError || !aiSettings) {
      console.error('Error fetching AI settings:', settingsError);
      throw new Error('AI settings not found');
    }

    console.log('AI Settings loaded:', aiSettings);

    const greeting = aiSettings.custom_greeting || 'Hello, my name is Clarice from Family Dental, how may I help you?';
    const voiceId = aiSettings.voice_id || 'sIak7pFapfSLCfctxdOu';
    const voiceModel = aiSettings.voice_model || 'eleven_multilingual_v2';

    // Call ElevenLabs TTS
    const elevenlabsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('ELEVENLABS_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: greeting,
        model_id: voiceModel,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.1
        }
      }),
    });

    if (!elevenlabsResponse.ok) {
      const error = await elevenlabsResponse.text();
      console.error('ElevenLabs API error:', error);
      throw new Error(`ElevenLabs API error: ${error}`);
    }

    console.log('ElevenLabs TTS successful');

    // Get audio data
    const audioData = await elevenlabsResponse.arrayBuffer();
    const audioBlob = new Uint8Array(audioData);

    // Upload to Supabase Storage
    const fileName = `greetings/${clinic_id}.mp3`;
    const { error: uploadError } = await supabase.storage
      .from('audio')
      .upload(fileName, audioBlob, {
        contentType: 'audio/mpeg',
        upsert: true
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw new Error(`Failed to upload audio: ${uploadError.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('audio')
      .getPublicUrl(fileName);

    console.log('Audio uploaded to:', publicUrl);

    // Update ai_settings with greeting_audio_url
    const { error: updateError } = await supabase
      .from('ai_settings')
      .update({ 
        greeting_audio_url: publicUrl,
        updated_at: new Date().toISOString()
      })
      .eq('clinic_id', clinic_id);

    if (updateError) {
      console.error('Error updating AI settings:', updateError);
      throw new Error(`Failed to update settings: ${updateError.message}`);
    }

    console.log('AI settings updated with greeting URL');

    return new Response(JSON.stringify({ 
      success: true, 
      greeting_audio_url: publicUrl,
      voice_id: voiceId,
      voice_model: voiceModel
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-build-greeting:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});