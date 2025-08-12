import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Security cleanup job starting...');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Run the cleanup function
    const { error } = await supabase.rpc('cleanup_old_data');
    
    if (error) {
      console.error('Cleanup error:', error);
      throw error;
    }

    console.log('Security cleanup completed successfully');

    // Additional monitoring: Check for patterns that might indicate security issues
    
    // 1. Check for unusual login patterns
    const { data: recentLogins } = await supabase
      .from('security_audit_log')
      .select('user_id, created_at, metadata')
      .eq('action_type', 'user_login')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    if (recentLogins) {
      // Group by user and check for excessive login attempts
      const loginsByUser = recentLogins.reduce((acc: any, login) => {
        acc[login.user_id] = (acc[login.user_id] || 0) + 1;
        return acc;
      }, {});

      for (const [userId, count] of Object.entries(loginsByUser)) {
        if ((count as number) > 20) { // More than 20 logins in 24 hours
          console.log(`Suspicious login activity detected for user ${userId}: ${count} logins in 24h`);
          
          // Get user's clinic for alert
          const { data: profile } = await supabase
            .from('profiles')
            .select('clinic_id')
            .eq('user_id', userId)
            .single();

          if (profile?.clinic_id) {
            await supabase.rpc('create_security_alert', {
              p_clinic_id: profile.clinic_id,
              p_alert_type: 'excessive_login_attempts',
              p_severity: 'medium',
              p_description: `User has ${count} login attempts in the last 24 hours`,
              p_metadata: { user_id: userId, login_count: count, timeframe: '24h' }
            });
          }
        }
      }
    }

    // 2. Check for data export activities
    const { data: dataExports } = await supabase
      .from('security_audit_log')
      .select('*')
      .eq('action_type', 'export_data')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (dataExports && dataExports.length > 10) {
      console.log(`High data export activity detected: ${dataExports.length} exports in last 7 days`);
      
      // Create alert for first clinic found (since this is cross-clinic monitoring)
      const firstExport = dataExports[0];
      const { data: profile } = await supabase
        .from('profiles')
        .select('clinic_id')
        .eq('user_id', firstExport.user_id)
        .single();

      if (profile?.clinic_id) {
        await supabase.rpc('create_security_alert', {
          p_clinic_id: profile.clinic_id,
          p_alert_type: 'high_export_activity',
          p_severity: 'medium',
          p_description: `${dataExports.length} data exports detected in the last week`,
          p_metadata: { export_count: dataExports.length, timeframe: '7d' }
        });
      }
    }

    // 3. Check for off-hours critical actions
    const now = new Date();
    const currentHour = now.getHours();
    
    if (currentHour >= 22 || currentHour <= 6) { // Between 10 PM and 6 AM
      const { data: offHoursActivity } = await supabase
        .from('security_audit_log')
        .select('*')
        .in('action_type', ['delete_patient', 'role_updated', 'pms_credential_access'])
        .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()); // Last hour

      if (offHoursActivity && offHoursActivity.length > 0) {
        console.log(`Off-hours critical activity detected: ${offHoursActivity.length} actions`);
        
        for (const activity of offHoursActivity) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('clinic_id')
            .eq('user_id', activity.user_id)
            .single();

          if (profile?.clinic_id) {
            await supabase.rpc('create_security_alert', {
              p_clinic_id: profile.clinic_id,
              p_alert_type: 'off_hours_critical_action',
              p_severity: 'high',
              p_description: `Critical action ${activity.action_type} performed during off-hours`,
              p_metadata: { 
                action_type: activity.action_type,
                time: activity.created_at,
                user_id: activity.user_id 
              }
            });
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Security cleanup and monitoring completed',
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Security cleanup job error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});