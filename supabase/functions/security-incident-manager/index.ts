import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface IncidentRequest {
  action: 'create' | 'list' | 'update' | 'resolve'
  incidentData?: {
    type: 'data_breach' | 'unauthorized_access' | 'system_compromise' | 'policy_violation'
    severity: 'low' | 'medium' | 'high' | 'critical'
    description: string
    affectedResources?: string[]
    metadata?: any
  }
  incidentId?: string
  updateData?: any
}

interface SecurityIncident {
  id: string
  type: string
  severity: string
  description: string
  status: 'open' | 'investigating' | 'contained' | 'resolved'
  created_at: string
  updated_at: string
  resolved_at?: string
  affected_resources: string[]
  response_actions: any[]
  metadata: any
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

    // Get user profile and verify permissions
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

    // Check if user has permission for incident management
    if (profile.role !== 'owner' && profile.admin_role !== 'technical_admin') {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions for incident management' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { action, incidentData, incidentId, updateData }: IncidentRequest = await req.json()

    console.log(`Security incident management: ${action}`)

    let result = {}

    switch (action) {
      case 'create':
        if (!incidentData) {
          return new Response(
            JSON.stringify({ error: 'Incident data required for creation' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Create security incident record
        const incident: SecurityIncident = {
          id: crypto.randomUUID(),
          type: incidentData.type,
          severity: incidentData.severity,
          description: incidentData.description,
          status: 'open',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          affected_resources: incidentData.affectedResources || [],
          response_actions: [
            {
              action: 'incident_created',
              timestamp: new Date().toISOString(),
              user_id: user.id,
              details: 'Security incident formally created and logged'
            }
          ],
          metadata: {
            ...incidentData.metadata,
            created_by: user.id,
            clinic_id: profile.clinic_id,
            auto_escalated: incidentData.severity === 'critical'
          }
        }

        // Store incident in security_alerts table
        const { error: createError } = await supabase.rpc('create_security_alert', {
          p_clinic_id: profile.clinic_id,
          p_alert_type: `incident_${incidentData.type}`,
          p_severity: incidentData.severity,
          p_description: incidentData.description,
          p_metadata: incident
        })

        if (createError) {
          console.error('Failed to create security incident:', createError)
          return new Response(
            JSON.stringify({ error: 'Failed to create incident', details: createError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Auto-escalate critical incidents
        if (incidentData.severity === 'critical') {
          // Trigger emergency notifications
          await supabase.rpc('create_security_alert', {
            p_clinic_id: profile.clinic_id,
            p_alert_type: 'critical_incident_escalation',
            p_severity: 'critical',
            p_description: `Critical incident auto-escalated: ${incidentData.description}`,
            p_metadata: {
              original_incident_id: incident.id,
              escalated_at: new Date().toISOString(),
              requires_immediate_response: true
            }
          })
        }

        // Log incident creation
        await supabase.rpc('log_sensitive_access', {
          p_clinic_id: profile.clinic_id,
          p_action_type: 'security_incident_created',
          p_resource_type: 'security_incident',
          p_resource_id: null,
          p_metadata: {
            incident_id: incident.id,
            incident_type: incidentData.type,
            severity: incidentData.severity,
            created_by: user.id,
            risk_level: 'critical'
          }
        })

        result = { incident, created: true }
        break

      case 'list':
        // Get recent security incidents
        const { data: incidents, error: listError } = await supabase
          .from('security_alerts')
          .select('*')
          .eq('clinic_id', profile.clinic_id)
          .like('alert_type', 'incident_%')
          .order('created_at', { ascending: false })
          .limit(50)

        if (listError) {
          console.error('Failed to list incidents:', listError)
          return new Response(
            JSON.stringify({ error: 'Failed to list incidents', details: listError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        result = { incidents: incidents || [] }
        break

      case 'update':
        if (!incidentId || !updateData) {
          return new Response(
            JSON.stringify({ error: 'Incident ID and update data required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Update incident record
        const { error: updateError } = await supabase
          .from('security_alerts')
          .update({
            metadata: updateData,
            resolved_at: updateData.status === 'resolved' ? new Date().toISOString() : null,
            resolved_by: updateData.status === 'resolved' ? user.id : null
          })
          .eq('id', incidentId)
          .eq('clinic_id', profile.clinic_id)

        if (updateError) {
          console.error('Failed to update incident:', updateError)
          return new Response(
            JSON.stringify({ error: 'Failed to update incident', details: updateError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Log incident update
        await supabase.rpc('log_sensitive_access', {
          p_clinic_id: profile.clinic_id,
          p_action_type: 'security_incident_updated',
          p_resource_type: 'security_incident',
          p_resource_id: incidentId,
          p_metadata: {
            updated_by: user.id,
            update_details: updateData,
            risk_level: 'high'
          }
        })

        result = { updated: true, incidentId }
        break

      case 'resolve':
        if (!incidentId) {
          return new Response(
            JSON.stringify({ error: 'Incident ID required for resolution' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Resolve incident
        const { error: resolveError } = await supabase
          .from('security_alerts')
          .update({
            resolved: true,
            resolved_at: new Date().toISOString(),
            resolved_by: user.id
          })
          .eq('id', incidentId)
          .eq('clinic_id', profile.clinic_id)

        if (resolveError) {
          console.error('Failed to resolve incident:', resolveError)
          return new Response(
            JSON.stringify({ error: 'Failed to resolve incident', details: resolveError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Log incident resolution
        await supabase.rpc('log_sensitive_access', {
          p_clinic_id: profile.clinic_id,
          p_action_type: 'security_incident_resolved',
          p_resource_type: 'security_incident',
          p_resource_id: incidentId,
          p_metadata: {
            resolved_by: user.id,
            resolved_at: new Date().toISOString(),
            risk_level: 'normal'
          }
        })

        result = { resolved: true, incidentId }
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
    console.error('Security incident manager error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})