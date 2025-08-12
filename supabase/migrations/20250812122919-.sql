-- Phase 3: Enhanced Security Measures
-- Data protection layers, security monitoring, and rate limiting

-- Fix any remaining function search path issues
-- Check for functions that might still need search_path set
DO $$
DECLARE
    func_record RECORD;
BEGIN
    -- Get all functions that don't have search_path set to ''
    FOR func_record IN 
        SELECT routine_name, routine_schema
        FROM information_schema.routines 
        WHERE routine_schema = 'public' 
        AND routine_type = 'FUNCTION'
        AND routine_name IN ('get_current_user_role', 'link_creator_to_clinic', 'get_allowed_call_outcomes')
    LOOP
        -- Re-create functions with proper search_path
        IF func_record.routine_name = 'get_current_user_role' THEN
            EXECUTE 'CREATE OR REPLACE FUNCTION public.get_current_user_role()
                     RETURNS text
                     LANGUAGE sql
                     STABLE SECURITY DEFINER
                     SET search_path = ''''
                     AS $func$
                       SELECT role FROM public.profiles WHERE user_id = auth.uid();
                     $func$';
        END IF;
        
        IF func_record.routine_name = 'get_allowed_call_outcomes' THEN
            EXECUTE 'CREATE OR REPLACE FUNCTION public.get_allowed_call_outcomes()
                     RETURNS text[]
                     LANGUAGE plpgsql
                     IMMUTABLE
                     SET search_path = ''''
                     AS $func$
                     BEGIN
                       RETURN ARRAY[''appointment_booked'', ''transferred'', ''voicemail'', ''no_answer'', ''cancelled'', ''completed'', ''failed''];
                     END;
                     $func$';
        END IF;
    END LOOP;
END $$;

-- Create security monitoring table for unusual activity detection
CREATE TABLE IF NOT EXISTS public.security_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  description text NOT NULL,
  metadata jsonb DEFAULT '{}',
  resolved boolean DEFAULT false,
  resolved_at timestamp with time zone,
  resolved_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on security alerts
ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;

-- Security alerts policy - only owners and technical admins can view
CREATE POLICY "Owners and tech admins can view security alerts" 
ON public.security_alerts 
FOR SELECT 
USING (
  clinic_id IN (
    SELECT clinic_id 
    FROM public.profiles 
    WHERE user_id = auth.uid()
  ) 
  AND (
    get_current_user_role() = 'owner' 
    OR has_admin_permission('view_audit_logs')
  )
);

-- Function to create security alerts
CREATE OR REPLACE FUNCTION public.create_security_alert(
  p_clinic_id uuid,
  p_alert_type text,
  p_severity text,
  p_description text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.security_alerts (
    clinic_id,
    alert_type,
    severity,
    description,
    metadata
  ) VALUES (
    p_clinic_id,
    p_alert_type,
    p_severity,
    p_description,
    p_metadata
  );
END;
$$;

-- Create rate limiting table for sensitive operations
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action_type text NOT NULL,
  count integer NOT NULL DEFAULT 1,
  window_start timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, action_type, window_start)
);

-- Enable RLS on rate limits
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Rate limits policy - users can only see their own
CREATE POLICY "Users can view their own rate limits" 
ON public.rate_limits 
FOR SELECT 
USING (user_id = auth.uid());

-- Function to check and enforce rate limits
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_action_type text,
  p_limit integer DEFAULT 10,
  p_window_minutes integer DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_count integer;
  window_start timestamp with time zone;
BEGIN
  -- Calculate window start time
  window_start := date_trunc('hour', now()) + 
                  (EXTRACT(minute FROM now())::integer / p_window_minutes) * 
                  interval '1 minute' * p_window_minutes;
  
  -- Clean up old rate limit records (older than 24 hours)
  DELETE FROM public.rate_limits 
  WHERE created_at < now() - interval '24 hours';
  
  -- Get current count for this user, action, and window
  SELECT count INTO current_count
  FROM public.rate_limits
  WHERE user_id = auth.uid() 
    AND action_type = p_action_type 
    AND window_start = window_start;
  
  -- If no record exists, create one
  IF current_count IS NULL THEN
    INSERT INTO public.rate_limits (user_id, action_type, window_start)
    VALUES (auth.uid(), p_action_type, window_start);
    RETURN true;
  END IF;
  
  -- If limit exceeded, return false
  IF current_count >= p_limit THEN
    RETURN false;
  END IF;
  
  -- Increment counter
  UPDATE public.rate_limits 
  SET count = count + 1 
  WHERE user_id = auth.uid() 
    AND action_type = p_action_type 
    AND window_start = window_start;
  
  RETURN true;
END;
$$;

-- Enhanced security monitoring function
CREATE OR REPLACE FUNCTION public.monitor_security_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  clinic_id_val uuid;
  user_profile_record RECORD;
  recent_count integer;
BEGIN
  -- Get user's clinic and profile info
  SELECT p.clinic_id, p.role, p.admin_role INTO clinic_id_val, user_profile_record.role, user_profile_record.admin_role
  FROM public.profiles p 
  WHERE p.user_id = NEW.user_id;
  
  IF clinic_id_val IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Check for suspicious patterns
  
  -- 1. Multiple failed authentication attempts (simulated by checking for elevated risk actions)
  IF NEW.risk_level = 'elevated' THEN
    SELECT COUNT(*) INTO recent_count
    FROM public.security_audit_log
    WHERE user_id = NEW.user_id 
      AND risk_level = 'elevated'
      AND created_at > now() - interval '1 hour';
    
    IF recent_count > 5 THEN
      PERFORM create_security_alert(
        clinic_id_val,
        'excessive_elevated_actions',
        'high',
        'User performed more than 5 elevated risk actions in 1 hour',
        jsonb_build_object(
          'user_id', NEW.user_id,
          'action_count', recent_count,
          'latest_action', NEW.action_type
        )
      );
    END IF;
  END IF;
  
  -- 2. Off-hours access to sensitive data
  IF NEW.action_type IN ('view_patients', 'export_data', 'pms_credential_access') 
     AND (EXTRACT(hour FROM now()) < 6 OR EXTRACT(hour FROM now()) > 22) THEN
    PERFORM create_security_alert(
      clinic_id_val,
      'off_hours_access',
      'medium',
      'Sensitive data accessed outside business hours',
      jsonb_build_object(
        'user_id', NEW.user_id,
        'action_type', NEW.action_type,
        'access_time', now(),
        'user_role', user_profile_record.role
      )
    );
  END IF;
  
  -- 3. Admin actions by non-admin users (potential privilege escalation)
  IF NEW.action_type LIKE '%admin%' 
     AND user_profile_record.role NOT IN ('owner', 'admin') 
     AND user_profile_record.admin_role IS NULL THEN
    PERFORM create_security_alert(
      clinic_id_val,
      'unauthorized_admin_action',
      'critical',
      'Non-admin user attempted admin action',
      jsonb_build_object(
        'user_id', NEW.user_id,
        'action_type', NEW.action_type,
        'user_role', user_profile_record.role,
        'admin_role', user_profile_record.admin_role
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for security monitoring
DROP TRIGGER IF EXISTS security_monitoring_trigger ON public.security_audit_log;
CREATE TRIGGER security_monitoring_trigger
  AFTER INSERT ON public.security_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.monitor_security_events();

-- Create data retention policy function
CREATE OR REPLACE FUNCTION public.cleanup_old_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Clean up old audit logs (keep 2 years)
  DELETE FROM public.security_audit_log 
  WHERE created_at < now() - interval '2 years';
  
  -- Clean up old rate limit records (keep 7 days)
  DELETE FROM public.rate_limits 
  WHERE created_at < now() - interval '7 days';
  
  -- Mark old security alerts as resolved if they're older than 30 days
  UPDATE public.security_alerts 
  SET resolved = true, resolved_at = now()
  WHERE created_at < now() - interval '30 days' 
    AND resolved = false;
  
  -- Clean up very old resolved alerts (keep 1 year)
  DELETE FROM public.security_alerts 
  WHERE resolved = true 
    AND (resolved_at < now() - interval '1 year' OR created_at < now() - interval '1 year');
END;
$$;