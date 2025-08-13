import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SessionRequest {
  action: 'validate' | 'invalidate' | 'check_device' | 'track_activity'
  sessionId?: string
  deviceFingerprint?: string
  activityData?: any
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

    const { action, sessionId, deviceFingerprint, activityData }: SessionRequest = await req.json()

    // Get client information
    const clientIP = req.headers.get('x-forwarded-for') || 
                    req.headers.get('x-real-ip') || 
                    'unknown'
    const userAgent = req.headers.get('user-agent') || 'unknown'

    console.log(`Session management: ${action} for user ${user.id}`)

    // Get user profile for clinic context
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('clinic_id, role, admin_role')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let result = {}

    switch (action) {
      case 'validate':
        // Validate session integrity
        const { data: sessionValid, error: validateError } = await supabase.rpc('validate_session_integrity')
        
        if (validateError) {
          console.error('Session validation error:', validateError)
          result = { valid: false, error: validateError.message }
        } else {
          result = { valid: sessionValid }
        }

        // Log session validation
        await supabase.rpc('log_sensitive_access', {
          p_clinic_id: profile.clinic_id,
          p_action_type: 'session_validation',
          p_resource_type: 'user_session',
          p_resource_id: user.id,
          p_metadata: {
            session_valid: sessionValid,
            client_ip: clientIP,
            user_agent: userAgent,
            device_fingerprint: deviceFingerprint
          }
        })
        break

      case 'check_device':
        // Check for suspicious device/location changes
        const { data: recentSessions, error: sessionError } = await supabase
          .from('security_audit_log')
          .select('metadata')
          .eq('user_id', user.id)
          .eq('action_type', 'session_validation')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: false })
          .limit(10)

        if (!sessionError && recentSessions) {
          const uniqueIPs = new Set(recentSessions.map(s => s.metadata?.client_ip).filter(Boolean))
          const uniqueDevices = new Set(recentSessions.map(s => s.metadata?.device_fingerprint).filter(Boolean))

          // Check for suspicious activity
          if (uniqueIPs.size > 5 || uniqueDevices.size > 3) {
            // Create security alert
            await supabase.rpc('create_security_alert', {
              p_clinic_id: profile.clinic_id,
              p_alert_type: 'suspicious_device_activity',
              p_severity: 'high',
              p_description: `User ${user.id} accessed from ${uniqueIPs.size} different IPs and ${uniqueDevices.size} devices in 24 hours`,
              p_metadata: {
                user_id: user.id,
                unique_ips: uniqueIPs.size,
                unique_devices: uniqueDevices.size,
                current_ip: clientIP,
                current_device: deviceFingerprint
              }
            })

            result = { suspicious: true, uniqueIPs: uniqueIPs.size, uniqueDevices: uniqueDevices.size }
          } else {
            result = { suspicious: false, uniqueIPs: uniqueIPs.size, uniqueDevices: uniqueDevices.size }
          }
        }
        break

      case 'track_activity':
        // Track user activity for session timeout
        await supabase.rpc('log_sensitive_access', {
          p_clinic_id: profile.clinic_id,
          p_action_type: 'user_activity',
          p_resource_type: 'session_activity',
          p_resource_id: user.id,
          p_metadata: {
            activity_type: activityData?.type || 'unknown',
            client_ip: clientIP,
            user_agent: userAgent,
            timestamp: new Date().toISOString(),
            ...activityData
          }
        })

        result = { tracked: true }
        break

      case 'invalidate':
        // Invalidate session (logout all devices)
        await supabase.rpc('log_sensitive_access', {
          p_clinic_id: profile.clinic_id,
          p_action_type: 'session_invalidated',
          p_resource_type: 'user_session',
          p_resource_id: user.id,
          p_metadata: {
            reason: 'manual_invalidation',
            client_ip: clientIP,
            user_agent: userAgent,
            risk_level: 'high'
          }
        })

        // Note: Actual session invalidation would require additional auth server logic
        result = { invalidated: true, message: 'Session marked for invalidation' }
        break

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Session manager error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})