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
    console.log('=== MANUAL GREETING TEST START ===');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the actual clinic_id from the request headers
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Get user's clinic_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('clinic_id')
      .eq('user_id', (await supabase.auth.getUser(authHeader.replace('Bearer ', ''))).data.user?.id)
      .single();

    if (profileError || !profile?.clinic_id) {
      throw new Error('Could not get clinic_id for user');
    }

    console.log('Using clinic_id:', profile.clinic_id);

    // Test calling ai-build-greeting directly
    console.log('Calling ai-build-greeting function...');
    const { data, error } = await supabase.functions.invoke('ai-build-greeting', {
      body: { clinic_id: profile.clinic_id },
      headers: { authorization: authHeader }
    });

    console.log('ai-build-greeting response:', { data, error });

    if (error) {
      console.error('Function call error:', error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message,
        details: error
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check current ai_settings state
    const { data: currentSettings, error: settingsError } = await supabase
      .from('ai_settings')
      .select('*')
      .eq('clinic_id', profile.clinic_id)
      .single();

    console.log('Current ai_settings:', currentSettings);

    return new Response(JSON.stringify({ 
      success: true,
      buildGreetingResult: data,
      currentSettings: currentSettings
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Test error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});