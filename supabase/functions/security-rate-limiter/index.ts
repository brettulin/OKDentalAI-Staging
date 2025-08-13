import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RateLimitRequest {
  action: string
  identifier?: string // IP, user ID, etc.
  limit?: number
  windowMinutes?: number
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the JWT
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { action, identifier, limit = 10, windowMinutes = 60 }: RateLimitRequest = await req.json()

    // Get client IP as fallback identifier
    const clientIP = req.headers.get('x-forwarded-for') || 
                    req.headers.get('x-real-ip') || 
                    'unknown'
    
    const rateLimitIdentifier = identifier || user.id || clientIP

    console.log(`Rate limit check: ${action} for ${rateLimitIdentifier}`)

    // Use the existing rate limit function
    const { data: isAllowed, error: rateLimitError } = await supabase.rpc('check_rate_limit', {
      p_action_type: `${action}_${rateLimitIdentifier}`,
      p_limit: limit,
      p_window_minutes: windowMinutes
    })

    if (rateLimitError) {
      console.error('Rate limit check error:', rateLimitError)
      return new Response(
        JSON.stringify({ error: 'Rate limit check failed', details: rateLimitError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Enhanced logging for security monitoring
    if (!isAllowed) {
      // Log rate limit violation
      const { error: logError } = await supabase.rpc('log_sensitive_access', {
        p_clinic_id: user.user_metadata?.clinic_id,
        p_action_type: 'rate_limit_exceeded',
        p_resource_type: 'api_endpoint',
        p_resource_id: null,
        p_metadata: {
          action,
          identifier: rateLimitIdentifier,
          client_ip: clientIP,
          user_agent: req.headers.get('user-agent'),
          limit,
          window_minutes: windowMinutes,
          risk_level: 'medium'
        }
      })

      if (logError) {
        console.error('Failed to log rate limit violation:', logError)
      }

      // Create security alert for excessive rate limiting
      const { error: alertError } = await supabase.rpc('create_security_alert', {
        p_clinic_id: user.user_metadata?.clinic_id,
        p_alert_type: 'rate_limit_exceeded',
        p_severity: 'medium',
        p_description: `Rate limit exceeded for action: ${action}`,
        p_metadata: {
          action,
          identifier: rateLimitIdentifier,
          client_ip: clientIP,
          user_id: user.id
        }
      })

      if (alertError) {
        console.error('Failed to create security alert:', alertError)
      }
    }

    return new Response(
      JSON.stringify({ 
        allowed: isAllowed,
        action,
        identifier: rateLimitIdentifier,
        limit,
        windowMinutes
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Security rate limiter error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})