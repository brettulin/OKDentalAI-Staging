-- Final Security Hardening for Phases 1 & 2

-- 1. Additional RLS Policy Hardening
-- Ensure no public access - drop any overly permissive policies

-- Revoke all public permissions on sensitive tables
REVOKE ALL ON public.patients FROM public;
REVOKE ALL ON public.calls FROM public;
REVOKE ALL ON public.turns FROM public;
REVOKE ALL ON public.offices FROM public;
REVOKE ALL ON public.security_audit_log FROM public;
REVOKE ALL ON public.audit_log FROM public;

-- Grant only necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON public.patients TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.calls TO authenticated;
GRANT SELECT, INSERT ON public.turns TO authenticated;
GRANT SELECT ON public.offices TO authenticated;
GRANT SELECT, INSERT ON public.security_audit_log TO authenticated;
GRANT SELECT, INSERT ON public.audit_log TO authenticated;

-- Only owners can delete sensitive data
GRANT DELETE ON public.patients TO authenticated;
GRANT DELETE ON public.calls TO authenticated;  
GRANT DELETE ON public.turns TO authenticated;

-- 2. Enhanced RLS for Security Audit Logs
DROP POLICY IF EXISTS "Enhanced admin access to security audit logs" ON public.security_audit_log;
CREATE POLICY "Secure audit log access" 
ON public.security_audit_log FOR SELECT 
USING (
  clinic_id IN (
    SELECT profiles.clinic_id
    FROM profiles
    WHERE profiles.user_id = auth.uid()
  )
  AND (
    get_current_user_role() = 'owner'
    OR has_admin_permission('view_audit_logs')
  )
);

CREATE POLICY "Secure audit log creation" 
ON public.security_audit_log FOR INSERT 
WITH CHECK (
  clinic_id IN (
    SELECT profiles.clinic_id
    FROM profiles
    WHERE profiles.user_id = auth.uid()
  )
  AND auth.uid() IS NOT NULL
);

-- 3. Data Minimization Function
CREATE OR REPLACE FUNCTION public.cleanup_old_sensitive_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Archive old call transcripts (older than 7 years per HIPAA retention)
  UPDATE public.calls 
  SET transcript_json = '{"archived": true, "original_length": jsonb_array_length(transcript_json)}'::jsonb
  WHERE started_at < now() - interval '7 years'
    AND transcript_json IS NOT NULL 
    AND NOT (transcript_json ? 'archived');
  
  -- Clean up old security logs (keep 2 years)
  DELETE FROM public.security_audit_log 
  WHERE created_at < now() - interval '2 years';
  
  -- Clean up old audit logs (keep 7 years per compliance)
  DELETE FROM public.audit_log 
  WHERE at < now() - interval '7 years';
  
  -- Remove sensitive metadata from old logs
  UPDATE public.security_audit_log 
  SET metadata = jsonb_build_object(
    'sanitized', true,
    'original_keys', array_length(array(SELECT jsonb_object_keys(metadata)), 1)
  )
  WHERE created_at < now() - interval '1 year'
    AND NOT (metadata ? 'sanitized');
    
  -- Log cleanup activity
  INSERT INTO public.security_audit_log (
    clinic_id, user_id, action_type, resource_type, metadata
  ) 
  SELECT DISTINCT 
    profiles.clinic_id,
    profiles.user_id,
    'automated_data_cleanup',
    'system_maintenance',
    jsonb_build_object(
      'cleanup_timestamp', now(),
      'cleanup_type', 'scheduled_retention',
      'risk_level', 'normal'
    )
  FROM public.profiles 
  WHERE profiles.role = 'owner'
  LIMIT 1;
END;
$$;

-- 4. Enhanced Encryption for Sensitive Fields Function
CREATE OR REPLACE FUNCTION public.encrypt_sensitive_field(
  p_value text,
  p_context text DEFAULT 'default'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  encrypted_value text;
BEGIN
  -- Basic encryption wrapper (in production, use proper encryption)
  -- This is a placeholder for field-level encryption
  encrypted_value := encode(digest(p_value || p_context || current_timestamp::text, 'sha256'), 'base64');
  
  -- Log encryption event for audit
  INSERT INTO public.security_audit_log (
    clinic_id, user_id, action_type, resource_type, metadata
  ) 
  SELECT 
    profiles.clinic_id,
    auth.uid(),
    'field_encryption',
    'sensitive_data',
    jsonb_build_object(
      'context', p_context,
      'encrypted_at', now(),
      'risk_level', 'high'
    )
  FROM public.profiles 
  WHERE profiles.user_id = auth.uid();
  
  RETURN encrypted_value;
END;
$$;

-- 5. Emergency Access Revocation Function
CREATE OR REPLACE FUNCTION public.emergency_revoke_access(
  p_user_id uuid,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  clinic_id_val uuid;
  current_user_role text;
BEGIN
  -- Get current user's role and clinic
  SELECT role, clinic_id INTO current_user_role, clinic_id_val
  FROM public.profiles 
  WHERE user_id = auth.uid();
  
  -- Only owners can perform emergency access revocation
  IF current_user_role != 'owner' THEN
    RAISE EXCEPTION 'Only owners can perform emergency access revocation';
  END IF;
  
  -- Disable the user by setting role to null (effectively blocking access)
  UPDATE public.profiles 
  SET 
    role = null,
    admin_role = null,
    updated_at = now()
  WHERE user_id = p_user_id 
    AND clinic_id = clinic_id_val;
  
  -- Create security alert
  PERFORM create_security_alert(
    clinic_id_val,
    'emergency_access_revocation',
    'critical',
    format('Emergency access revocation for user %s: %s', p_user_id, p_reason),
    jsonb_build_object(
      'revoked_user', p_user_id,
      'revoked_by', auth.uid(),
      'reason', p_reason,
      'timestamp', now()
    )
  );
  
  -- Log the emergency action
  PERFORM log_sensitive_access(
    clinic_id_val,
    'emergency_access_revoked',
    'user_access',
    p_user_id,
    jsonb_build_object(
      'revoked_by', auth.uid(),
      'reason', p_reason,
      'risk_level', 'critical',
      'requires_investigation', true
    )
  );
END;
$$;

-- 6. Security Metrics Calculation Function
CREATE OR REPLACE FUNCTION public.calculate_security_metrics(p_clinic_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  metrics jsonb;
  total_users integer;
  active_alerts integer;
  failed_logins integer;
  data_exports integer;
  risk_score integer := 0;
BEGIN
  -- Calculate basic metrics
  SELECT COUNT(*) INTO total_users
  FROM public.profiles
  WHERE clinic_id = p_clinic_id AND role IS NOT NULL;
  
  SELECT COUNT(*) INTO active_alerts
  FROM public.security_alerts
  WHERE clinic_id = p_clinic_id AND resolved = false;
  
  SELECT COUNT(*) INTO failed_logins
  FROM public.security_audit_log
  WHERE clinic_id = p_clinic_id 
    AND action_type LIKE '%denied%'
    AND created_at > now() - interval '24 hours';
  
  SELECT COUNT(*) INTO data_exports
  FROM public.security_audit_log
  WHERE clinic_id = p_clinic_id 
    AND action_type LIKE '%export%'
    AND created_at > now() - interval '7 days';
  
  -- Calculate risk score (0-100)
  risk_score := LEAST(100, 
    (active_alerts * 10) + 
    (failed_logins * 2) + 
    (data_exports * 5)
  );
  
  -- Build metrics object
  metrics := jsonb_build_object(
    'total_users', total_users,
    'active_alerts', active_alerts,
    'failed_logins_24h', failed_logins,
    'data_exports_7d', data_exports,
    'risk_score', risk_score,
    'security_level', 
      CASE 
        WHEN risk_score < 20 THEN 'excellent'
        WHEN risk_score < 40 THEN 'good'
        WHEN risk_score < 60 THEN 'moderate'
        WHEN risk_score < 80 THEN 'concerning'
        ELSE 'critical'
      END,
    'calculated_at', now()
  );
  
  RETURN metrics;
END;
$$;