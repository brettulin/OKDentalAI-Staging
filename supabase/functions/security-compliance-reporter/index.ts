import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ComplianceRequest {
  reportType: 'hipaa' | 'audit' | 'security' | 'access'
  startDate?: string
  endDate?: string
  clinicId?: string
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

    // Check if user has permission to generate compliance reports
    if (profile.role !== 'owner' && profile.admin_role !== 'technical_admin') {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions for compliance reporting' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { reportType, startDate, endDate, clinicId }: ComplianceRequest = await req.json()

    // Use the requesting user's clinic if not specified
    const targetClinicId = clinicId || profile.clinic_id

    // Set default date range (last 30 days)
    const end = endDate ? new Date(endDate) : new Date()
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    console.log(`Generating ${reportType} compliance report for clinic ${targetClinicId}`)

    let reportData = {}

    switch (reportType) {
      case 'hipaa':
        // HIPAA Compliance Report
        const { data: patientAccess, error: patientError } = await supabase
          .from('security_audit_log')
          .select('*')
          .eq('clinic_id', targetClinicId)
          .in('resource_type', ['patient_phi', 'patient'])
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString())
          .order('created_at', { ascending: false })

        if (patientError) {
          throw new Error(`Patient access query failed: ${patientError.message}`)
        }

        // Aggregate HIPAA metrics
        const totalPatientAccess = patientAccess?.length || 0
        const unauthorizedAccess = patientAccess?.filter(a => a.action_type.includes('denied')).length || 0
        const exportEvents = patientAccess?.filter(a => a.action_type.includes('export')).length || 0
        const highRiskEvents = patientAccess?.filter(a => a.risk_level === 'high' || a.risk_level === 'critical').length || 0

        reportData = {
          reportType: 'HIPAA Compliance Report',
          period: { start: start.toISOString(), end: end.toISOString() },
          metrics: {
            totalPatientAccess,
            unauthorizedAccess,
            exportEvents,
            highRiskEvents,
            complianceScore: Math.max(0, 100 - (unauthorizedAccess * 10) - (highRiskEvents * 5))
          },
          details: patientAccess?.slice(0, 100) // Limit for response size
        }
        break

      case 'audit':
        // Security Audit Report
        const { data: auditLogs, error: auditError } = await supabase
          .from('security_audit_log')
          .select('action_type, resource_type, risk_level, created_at, metadata')
          .eq('clinic_id', targetClinicId)
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString())
          .order('created_at', { ascending: false })

        if (auditError) {
          throw new Error(`Audit logs query failed: ${auditError.message}`)
        }

        // Aggregate audit metrics
        const totalEvents = auditLogs?.length || 0
        const criticalEvents = auditLogs?.filter(a => a.risk_level === 'critical').length || 0
        const highRiskEvents2 = auditLogs?.filter(a => a.risk_level === 'high').length || 0
        const eventsByType = auditLogs?.reduce((acc, log) => {
          acc[log.action_type] = (acc[log.action_type] || 0) + 1
          return acc
        }, {} as Record<string, number>) || {}

        reportData = {
          reportType: 'Security Audit Report',
          period: { start: start.toISOString(), end: end.toISOString() },
          metrics: {
            totalEvents,
            criticalEvents,
            highRiskEvents: highRiskEvents2,
            eventsByType
          },
          recentEvents: auditLogs?.slice(0, 50)
        }
        break

      case 'security':
        // Security Alerts Report
        const { data: securityAlerts, error: alertError } = await supabase
          .from('security_alerts')
          .select('*')
          .eq('clinic_id', targetClinicId)
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString())
          .order('created_at', { ascending: false })

        if (alertError) {
          throw new Error(`Security alerts query failed: ${alertError.message}`)
        }

        const totalAlerts = securityAlerts?.length || 0
        const criticalAlerts = securityAlerts?.filter(a => a.severity === 'critical').length || 0
        const resolvedAlerts = securityAlerts?.filter(a => a.resolved).length || 0
        const alertsByType = securityAlerts?.reduce((acc, alert) => {
          acc[alert.alert_type] = (acc[alert.alert_type] || 0) + 1
          return acc
        }, {} as Record<string, number>) || {}

        reportData = {
          reportType: 'Security Alerts Report',
          period: { start: start.toISOString(), end: end.toISOString() },
          metrics: {
            totalAlerts,
            criticalAlerts,
            resolvedAlerts,
            resolutionRate: totalAlerts > 0 ? (resolvedAlerts / totalAlerts * 100).toFixed(2) : '100',
            alertsByType
          },
          alerts: securityAlerts
        }
        break

      case 'access':
        // Access Control Report
        const { data: accessLogs, error: accessError } = await supabase
          .from('security_audit_log')
          .select('user_id, action_type, resource_type, created_at')
          .eq('clinic_id', targetClinicId)
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString())
          .order('created_at', { ascending: false })

        if (accessError) {
          throw new Error(`Access logs query failed: ${accessError.message}`)
        }

        // Aggregate access metrics
        const uniqueUsers = new Set(accessLogs?.map(l => l.user_id)).size
        const totalAccess = accessLogs?.length || 0
        const deniedAccess = accessLogs?.filter(l => l.action_type.includes('denied')).length || 0
        const userActivity = accessLogs?.reduce((acc, log) => {
          if (log.user_id) {
            acc[log.user_id] = (acc[log.user_id] || 0) + 1
          }
          return acc
        }, {} as Record<string, number>) || {}

        reportData = {
          reportType: 'Access Control Report',
          period: { start: start.toISOString(), end: end.toISOString() },
          metrics: {
            uniqueUsers,
            totalAccess,
            deniedAccess,
            accessDenialRate: totalAccess > 0 ? (deniedAccess / totalAccess * 100).toFixed(2) : '0',
            userActivity: Object.entries(userActivity).slice(0, 20) // Top 20 most active users
          }
        }
        break

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid report type' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    // Log the compliance report generation
    await supabase.rpc('log_sensitive_access', {
      p_clinic_id: targetClinicId,
      p_action_type: 'compliance_report_generated',
      p_resource_type: 'compliance_data',
      p_resource_id: null,
      p_metadata: {
        report_type: reportType,
        start_date: start.toISOString(),
        end_date: end.toISOString(),
        generated_by: user.id,
        risk_level: 'elevated'
      }
    })

    return new Response(
      JSON.stringify(reportData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Compliance reporter error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})