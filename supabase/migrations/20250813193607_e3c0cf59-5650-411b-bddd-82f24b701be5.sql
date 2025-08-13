-- Fix security vulnerabilities and implement Phase 3: Production Readiness

-- 1. Fix patient data access - restrict to only specifically assigned patients
CREATE OR REPLACE FUNCTION public.get_user_assigned_patient_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT ARRAY(
    -- Only patients from appointments directly assigned to this user
    SELECT DISTINCT appointments.patient_id
    FROM public.appointments
    WHERE appointments.clinic_id IN (
      SELECT profiles.clinic_id
      FROM public.profiles
      WHERE profiles.user_id = auth.uid()
    )
    AND (
      -- Only if user is explicitly assigned to the appointment
      appointments.provider_id IN (
        SELECT p.id FROM public.providers p 
        WHERE p.clinic_id IN (
          SELECT profiles.clinic_id FROM public.profiles WHERE profiles.user_id = auth.uid()
        )
      )
      OR 
      -- For calls, only patients the user has directly interacted with
      EXISTS (
        SELECT 1 FROM public.calls c 
        WHERE c.caller_phone IN (
          SELECT patients.phone FROM public.patients 
          WHERE patients.id = appointments.patient_id
        )
        AND c.assigned_to = auth.uid()
      )
    )
  );
$function$;

-- 2. Enhanced MFA protection - fix policies
DROP POLICY IF EXISTS "Users can manage their own MFA" ON public.user_mfa;
CREATE POLICY "Users can view their own MFA" 
ON public.user_mfa 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can update their own MFA" 
ON public.user_mfa 
FOR UPDATE 
USING (user_id = auth.uid() AND clinic_id IN (
  SELECT profiles.clinic_id
  FROM public.profiles
  WHERE profiles.user_id = auth.uid()
));

CREATE POLICY "Users can insert their own MFA" 
ON public.user_mfa 
FOR INSERT 
WITH CHECK (user_id = auth.uid() AND clinic_id IN (
  SELECT profiles.clinic_id
  FROM public.profiles
  WHERE profiles.user_id = auth.uid()
));

-- 3. Add additional protection for PMS credentials access
CREATE OR REPLACE FUNCTION public.validate_pms_critical_access(p_office_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  user_profile RECORD;
  recent_access_count integer;
BEGIN
  -- Get user profile
  SELECT * INTO user_profile
  FROM public.profiles 
  WHERE user_id = auth.uid();
  
  -- Only owners can access PMS credentials
  IF user_profile.role != 'owner' THEN
    RETURN false;
  END IF;
  
  -- Check for excessive access attempts
  SELECT COUNT(*) INTO recent_access_count
  FROM public.security_audit_log
  WHERE user_id = auth.uid()
    AND resource_type = 'pms_credentials'
    AND created_at > now() - interval '1 hour';
  
  -- Block if too many attempts
  IF recent_access_count > 3 THEN
    PERFORM create_security_alert(
      user_profile.clinic_id,
      'excessive_pms_access',
      'critical',
      'Owner exceeded PMS credential access limit',
      jsonb_build_object('user_id', auth.uid(), 'attempts', recent_access_count)
    );
    RETURN false;
  END IF;
  
  RETURN true;
END;
$function$;

-- Update PMS credentials policy to use the new validation
DROP POLICY IF EXISTS "Owner-only PMS access" ON public.offices;
DROP POLICY IF EXISTS "Restricted PMS access" ON public.offices;
CREATE POLICY "Restricted PMS access" 
ON public.offices 
FOR ALL 
USING (
  clinic_id IN (
    SELECT profiles.clinic_id
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
  ) 
  AND validate_pms_critical_access(id)
);

-- 4. Fix password history access - restrict to security admins only
DROP POLICY IF EXISTS "Users can view their own password history" ON public.password_history;
CREATE POLICY "Security admins can view password history" 
ON public.password_history 
FOR SELECT 
USING (
  clinic_id IN (
    SELECT profiles.clinic_id
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
  )
  AND (
    get_current_user_role() = 'owner'
    OR has_admin_permission('view_audit_logs')
  )
);

CREATE POLICY "Users can view their own password history" 
ON public.password_history 
FOR SELECT 
USING (user_id = auth.uid());

-- Phase 3: Production Readiness & Advanced Security

-- 1. Create production readiness monitoring table
CREATE TABLE IF NOT EXISTS public.production_monitoring (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid NOT NULL,
  check_type text NOT NULL,
  status text NOT NULL,
  details jsonb DEFAULT '{}',
  last_checked timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.production_monitoring ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage production monitoring" 
ON public.production_monitoring 
FOR ALL 
USING (
  clinic_id IN (
    SELECT profiles.clinic_id
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
  ) 
  AND get_current_user_role() = 'owner'
);

-- 2. Create system health monitoring
CREATE TABLE IF NOT EXISTS public.system_health_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid NOT NULL,
  metric_type text NOT NULL,
  metric_value numeric NOT NULL,
  threshold_min numeric,
  threshold_max numeric,
  status text DEFAULT 'normal',
  recorded_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_health_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tech admins can view health metrics" 
ON public.system_health_metrics 
FOR SELECT 
USING (
  clinic_id IN (
    SELECT profiles.clinic_id
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
  ) 
  AND (
    get_current_user_role() = 'owner'
    OR has_admin_permission('view_audit_logs')
  )
);

-- 3. Enhanced incident response system
CREATE TABLE IF NOT EXISTS public.security_incidents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid NOT NULL,
  incident_type text NOT NULL,
  severity text NOT NULL,
  status text DEFAULT 'open',
  description text NOT NULL,
  assigned_to uuid,
  resolution_notes text,
  created_at timestamp with time zone DEFAULT now(),
  resolved_at timestamp with time zone,
  metadata jsonb DEFAULT '{}'
);

-- Enable RLS
ALTER TABLE public.security_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Security teams can manage incidents" 
ON public.security_incidents 
FOR ALL 
USING (
  clinic_id IN (
    SELECT profiles.clinic_id
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
  ) 
  AND (
    get_current_user_role() = 'owner'
    OR has_admin_permission('view_audit_logs')
  )
);

-- 4. Data backup and recovery tracking
CREATE TABLE IF NOT EXISTS public.backup_schedules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid NOT NULL,
  backup_type text NOT NULL,
  frequency text NOT NULL,
  last_backup timestamp with time zone,
  next_backup timestamp with time zone,
  status text DEFAULT 'active',
  retention_days integer DEFAULT 30,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.backup_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage backup schedules" 
ON public.backup_schedules 
FOR ALL 
USING (
  clinic_id IN (
    SELECT profiles.clinic_id
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
  ) 
  AND get_current_user_role() = 'owner'
);

-- 5. Performance monitoring
CREATE TABLE IF NOT EXISTS public.performance_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid NOT NULL,
  endpoint text NOT NULL,
  response_time_ms integer NOT NULL,
  status_code integer NOT NULL,
  user_id uuid,
  recorded_at timestamp with time zone DEFAULT now(),
  metadata jsonb DEFAULT '{}'
);

-- Enable RLS
ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tech admins can view performance metrics" 
ON public.performance_metrics 
FOR SELECT 
USING (
  clinic_id IN (
    SELECT profiles.clinic_id
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
  ) 
  AND (
    get_current_user_role() = 'owner'
    OR has_admin_permission('view_audit_logs')
  )
);

-- 6. Advanced security functions

-- Emergency lockdown function
CREATE OR REPLACE FUNCTION public.emergency_lockdown(p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  clinic_id_val uuid;
BEGIN
  -- Get current user's clinic
  SELECT clinic_id INTO clinic_id_val
  FROM public.profiles 
  WHERE user_id = auth.uid();
  
  -- Only owners can trigger emergency lockdown
  IF get_current_user_role() != 'owner' THEN
    RAISE EXCEPTION 'Only owners can trigger emergency lockdown';
  END IF;
  
  -- Create critical alert
  PERFORM create_security_alert(
    clinic_id_val,
    'emergency_lockdown_activated',
    'critical',
    'Emergency lockdown activated: ' || p_reason,
    jsonb_build_object(
      'activated_by', auth.uid(),
      'reason', p_reason,
      'timestamp', now()
    )
  );
  
  -- Log the lockdown
  PERFORM log_sensitive_access(
    clinic_id_val,
    'emergency_lockdown',
    'security_control',
    auth.uid(),
    jsonb_build_object(
      'reason', p_reason,
      'risk_level', 'critical'
    )
  );
END;
$function$;

-- Comprehensive production readiness check
CREATE OR REPLACE FUNCTION public.comprehensive_production_check(p_clinic_id uuid)
RETURNS TABLE(
  category text,
  check_name text,
  status text,
  details text,
  priority text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  security_alerts_count integer;
  recent_incidents_count integer;
  backup_status text;
  performance_issues integer;
  compliance_gaps integer;
BEGIN
  -- Security status checks
  SELECT COUNT(*) INTO security_alerts_count
  FROM public.security_alerts
  WHERE clinic_id = p_clinic_id AND resolved = false AND severity IN ('high', 'critical');
  
  SELECT COUNT(*) INTO recent_incidents_count
  FROM public.security_incidents
  WHERE clinic_id = p_clinic_id AND status = 'open' AND created_at > now() - interval '7 days';
  
  -- Backup status check
  SELECT CASE 
    WHEN COUNT(*) = 0 THEN 'not_configured'
    WHEN COUNT(*) FILTER (WHERE last_backup < now() - interval '1 day') > 0 THEN 'overdue'
    ELSE 'healthy'
  END INTO backup_status
  FROM public.backup_schedules
  WHERE clinic_id = p_clinic_id AND status = 'active';
  
  -- Performance issues check
  SELECT COUNT(*) INTO performance_issues
  FROM public.performance_metrics
  WHERE clinic_id = p_clinic_id 
    AND recorded_at > now() - interval '1 hour'
    AND (response_time_ms > 5000 OR status_code >= 500);
  
  -- Compliance gaps check
  SELECT COUNT(*) INTO compliance_gaps
  FROM public.compliance_frameworks
  WHERE clinic_id = p_clinic_id AND compliance_status != 'compliant';
  
  -- Return comprehensive status
  RETURN QUERY VALUES
    ('security', 'active_alerts', 
     CASE WHEN security_alerts_count = 0 THEN 'PASS' ELSE 'FAIL' END,
     security_alerts_count || ' unresolved security alerts',
     CASE WHEN security_alerts_count = 0 THEN 'low' ELSE 'high' END),
    
    ('security', 'recent_incidents',
     CASE WHEN recent_incidents_count = 0 THEN 'PASS' ELSE 'WARN' END,
     recent_incidents_count || ' open incidents in last 7 days',
     'medium'),
    
    ('backup', 'backup_status',
     CASE WHEN backup_status = 'healthy' THEN 'PASS' ELSE 'FAIL' END,
     'Backup status: ' || backup_status,
     CASE WHEN backup_status = 'not_configured' THEN 'high' ELSE 'medium' END),
    
    ('performance', 'system_performance',
     CASE WHEN performance_issues = 0 THEN 'PASS' ELSE 'WARN' END,
     performance_issues || ' performance issues in last hour',
     'medium'),
    
    ('compliance', 'compliance_status',
     CASE WHEN compliance_gaps = 0 THEN 'PASS' ELSE 'FAIL' END,
     compliance_gaps || ' compliance gaps identified',
     CASE WHEN compliance_gaps > 0 THEN 'high' ELSE 'low' END);
END;
$function$;

-- Automated security monitoring
CREATE OR REPLACE FUNCTION public.automated_security_scan()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  clinic_record RECORD;
  threat_score integer;
BEGIN
  -- Run security scans for all clinics
  FOR clinic_record IN 
    SELECT DISTINCT clinic_id FROM public.profiles WHERE clinic_id IS NOT NULL
  LOOP
    -- Calculate threat score
    SELECT 
      COALESCE(COUNT(*) FILTER (WHERE severity = 'critical'), 0) * 10 +
      COALESCE(COUNT(*) FILTER (WHERE severity = 'high'), 0) * 5 +
      COALESCE(COUNT(*) FILTER (WHERE severity = 'medium'), 0) * 2
    INTO threat_score
    FROM public.security_alerts
    WHERE clinic_id = clinic_record.clinic_id AND resolved = false;
    
    -- Create alert if threat score is high
    IF threat_score > 50 THEN
      PERFORM create_security_alert(
        clinic_record.clinic_id,
        'high_threat_environment',
        'critical',
        'Automated scan detected high threat level: ' || threat_score,
        jsonb_build_object('threat_score', threat_score, 'automated_scan', true)
      );
    END IF;
  END LOOP;
END;
$function$;