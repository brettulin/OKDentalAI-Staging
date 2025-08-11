import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({ 
      ok: true, 
      timestamp: new Date().toISOString(),
      message: "Ping successful" 
    }),
    { 
      headers: { 
        ...corsHeaders,
        'Content-Type': 'application/json' 
      } 
    }
  );
});