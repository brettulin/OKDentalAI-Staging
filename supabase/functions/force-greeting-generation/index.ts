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
    console.log('=== FORCE GREETING GENERATION START ===');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Force generate for the specific clinic that's having issues
    const clinic_id = '550e8400-e29b-41d4-a716-446655440020';
    
    console.log('Force generating greeting for clinic:', clinic_id);
    
    // Call ai-build-greeting with service role
    const { data, error } = await supabase.functions.invoke('ai-build-greeting', {
      body: { clinic_id }
    });

    console.log('Generation result:', { data, error });

    if (error) {
      throw new Error(`Generation failed: ${error.message}`);
    }

    // Verify it was saved
    const { data: settings } = await supabase
      .from('ai_settings')
      .select('greeting_audio_url')
      .eq('clinic_id', clinic_id)
      .single();

    console.log('Verification - greeting_audio_url:', settings?.greeting_audio_url);

    return new Response(JSON.stringify({ 
      success: true,
      result: data,
      verified_url: settings?.greeting_audio_url
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Force generation error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});