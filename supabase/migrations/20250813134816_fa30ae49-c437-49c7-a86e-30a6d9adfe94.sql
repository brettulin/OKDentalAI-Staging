-- Phase 1 Security Enhancements: Critical Data Protection

-- 1. Enhanced Patient Data Security Functions
CREATE OR REPLACE FUNCTION public.validate_patient_access_with_logging(p_patient_id uuid, p_operation text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  has_access boolean;
  clinic_id_val uuid;
BEGIN
  -- Get user's clinic
  SELECT clinic_id INTO clinic_id_val
  FROM public.profiles 
  WHERE user_id = auth.uid();
  
  IF clinic_id_val IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check access using existing function
  SELECT user_can_access_patient(p_patient_id) INTO has_access;
  
  -- Enhanced logging
  PERFORM log_sensitive_access(
    clinic_id_val,
    CASE WHEN has_access THEN 'patient_access_granted' ELSE 'patient_access_denied' END,
    'patient_phi',
    p_patient_id,
    jsonb_build_object(
      'operation', p_operation,
      'access_time', now(),
      'risk_level', 
        CASE 
          WHEN p_operation IN ('delete', 'export') THEN 'critical'
          WHEN p_operation = 'edit' THEN 'high'
          ELSE 'normal'
        END,
      'requires_justification', p_operation IN ('delete', 'export', 'bulk_access')
    )
  );
  
  RETURN has_access;
END;
$$;

-- 2. Enhanced Call Transcript Security
CREATE OR REPLACE FUNCTION public.validate_call_transcript_access(p_call_id uuid, p_operation text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  call_record RECORD;
  has_access boolean DEFAULT false;
  user_role text;
  clinic_id_val uuid;
BEGIN
  -- Get user info
  SELECT p.role, p.clinic_id INTO user_role, clinic_id_val
  FROM public.profiles p 
  WHERE p.user_id = auth.uid();
  
  IF clinic_id_val IS NULL THEN
    RETURN false;
  END IF;
  
  -- Get call details
  SELECT * INTO call_record
  FROM public.calls 
  WHERE id = p_call_id AND clinic_id = clinic_id_val;
  
  IF NOT FOUND THEN
    -- Log unauthorized access attempt
    PERFORM log_sensitive_access(
      clinic_id_val,
      'call_access_denied',
      'call_transcript',
      p_call_id,
      jsonb_build_object(
        'reason', 'call_not_found_or_wrong_clinic',
        'operation', p_operation,
        'risk_level', 'high'
      )
    );
    RETURN false;
  END IF;
  
  -- Check access permissions
  -- Owners and doctors have full access
  IF user_role IN ('owner', 'doctor') THEN
    has_access := true;
  -- Assigned staff can access their calls
  ELSIF call_record.assigned_to = auth.uid() THEN
    has_access := true;
  -- Check patient relationship for other staff
  ELSIF user_role IN ('nurse', 'medical_assistant', 'admin') AND call_record.caller_phone IS NOT NULL THEN
    -- Check if user has access to patient with this phone
    SELECT EXISTS(
      SELECT 1 FROM public.patients p
      WHERE p.phone = call_record.caller_phone 
        AND p.clinic_id = clinic_id_val
        AND user_can_access_patient(p.id)
    ) INTO has_access;
  END IF;
  
  -- Enhanced logging with risk assessment
  PERFORM log_sensitive_access(
    clinic_id_val,
    CASE WHEN has_access THEN 'call_access_granted' ELSE 'call_access_denied' END,
    'call_transcript',
    p_call_id,
    jsonb_build_object(
      'operation', p_operation,
      'caller_phone', call_record.caller_phone,
      'assigned_to', call_record.assigned_to,
      'user_role', user_role,
      'access_method', 
        CASE 
          WHEN user_role IN ('owner', 'doctor') THEN 'role_based'
          WHEN call_record.assigned_to = auth.uid() THEN 'assignment_based'
          ELSE 'patient_relationship'
        END,
      'risk_level',
        CASE 
          WHEN p_operation = 'export' THEN 'critical'
          WHEN p_operation = 'edit' THEN 'high'
          ELSE 'normal'
        END
    )
  );
  
  RETURN has_access;
END;
$$;

-- 3. Enhanced PMS Credential Security
CREATE OR REPLACE FUNCTION public.validate_pms_credential_access(p_office_id uuid, p_purpose text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  user_profile RECORD;
  has_permission boolean DEFAULT false;
  recent_access_count integer;
BEGIN
  -- Get user profile
  SELECT * INTO user_profile
  FROM public.profiles 
  WHERE user_id = auth.uid();
  
  IF user_profile.clinic_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check permissions - only owners and technical admins
  IF user_profile.role = 'owner' OR 
     (user_profile.admin_role = 'technical_admin') THEN
    has_permission := true;
  END IF;
  
  -- Check for excessive access in last 24 hours
  SELECT COUNT(*) INTO recent_access_count
  FROM public.security_audit_log
  WHERE user_id = auth.uid()
    AND resource_type = 'pms_credentials'
    AND action_type = 'credential_access_granted'
    AND created_at > now() - interval '24 hours';
  
  -- Create security alert for excessive access
  IF recent_access_count > 5 THEN
    PERFORM create_security_alert(
      user_profile.clinic_id,
      'excessive_pms_credential_access',
      'critical',
      format('User %s accessed PMS credentials %s times in 24 hours', auth.uid(), recent_access_count + 1),
      jsonb_build_object(
        'user_id', auth.uid(),
        'office_id', p_office_id,
        'access_count', recent_access_count + 1,
        'purpose', p_purpose,
        'timeframe', '24_hours'
      )
    );
  END IF;
  
  -- Log access attempt with enhanced metadata
  PERFORM log_sensitive_access(
    user_profile.clinic_id,
    CASE WHEN has_permission THEN 'credential_access_granted' ELSE 'credential_access_denied' END,
    'pms_credentials',
    p_office_id,
    jsonb_build_object(
      'purpose', p_purpose,
      'user_role', user_profile.role,
      'admin_role', user_profile.admin_role,
      'recent_access_count', recent_access_count,
      'risk_level', 
        CASE 
          WHEN recent_access_count > 3 THEN 'critical'
          WHEN recent_access_count > 1 THEN 'high'
          ELSE 'elevated'
        END,
      'requires_justification', true,
      'access_timestamp', now()
    )
  );
  
  RETURN has_permission;
END;
$$;

-- 4. Enhanced Turn/Conversation Security
CREATE OR REPLACE FUNCTION public.validate_conversation_access(p_call_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  has_access boolean;
BEGIN
  -- Use existing call transcript validation
  SELECT validate_call_transcript_access(p_call_id, 'view_conversation') INTO has_access;
  RETURN has_access;
END;
$$;

-- 5. Update existing RLS policies with enhanced security

-- Enhanced Patient RLS Policy
DROP POLICY IF EXISTS "Enhanced patient access with audit" ON public.patients;
CREATE POLICY "Enhanced patient access with audit" 
ON public.patients 
FOR SELECT 
USING (
  clinic_id IN (
    SELECT profiles.clinic_id
    FROM profiles
    WHERE profiles.user_id = auth.uid()
  ) 
  AND validate_patient_access_with_logging(id, 'view')
);

-- Enhanced Call RLS Policy for transcripts
DROP POLICY IF EXISTS "Enhanced call transcript access" ON public.calls;
CREATE POLICY "Enhanced call transcript access" 
ON public.calls 
FOR SELECT 
USING (
  clinic_id IN (
    SELECT profiles.clinic_id
    FROM profiles
    WHERE profiles.user_id = auth.uid()
  ) 
  AND validate_call_transcript_access(id, 'view')
);

-- Enhanced Turns/Conversation RLS Policy
DROP POLICY IF EXISTS "Enhanced conversation access" ON public.turns;
CREATE POLICY "Enhanced conversation access" 
ON public.turns 
FOR SELECT 
USING (validate_conversation_access(call_id));

-- Enhanced PMS Credentials Policy
DROP POLICY IF EXISTS "Enhanced PMS credential access" ON public.offices;
CREATE POLICY "Enhanced PMS credential access" 
ON public.offices 
FOR SELECT 
USING (
  clinic_id IN (
    SELECT profiles.clinic_id
    FROM profiles
    WHERE profiles.user_id = auth.uid()
  ) 
  AND validate_pms_credential_access(id, 'view_configuration')
);

-- 6. Create security monitoring trigger
CREATE OR REPLACE FUNCTION public.monitor_sensitive_data_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  clinic_id_val uuid;
  risk_score integer DEFAULT 0;
BEGIN
  -- Get clinic ID
  SELECT clinic_id INTO clinic_id_val
  FROM public.profiles 
  WHERE user_id = NEW.user_id;
  
  -- Calculate risk score based on recent activity
  SELECT COUNT(*) INTO risk_score
  FROM public.security_audit_log
  WHERE user_id = NEW.user_id
    AND risk_level IN ('high', 'critical', 'elevated')
    AND created_at > now() - interval '1 hour';
  
  -- Trigger alerts for high-risk patterns
  IF risk_score > 10 THEN
    PERFORM create_security_alert(
      clinic_id_val,
      'high_risk_data_access_pattern',
      'critical',
      format('User %s performed %s high-risk actions in 1 hour', NEW.user_id, risk_score),
      jsonb_build_object(
        'user_id', NEW.user_id,
        'risk_score', risk_score,
        'latest_action', NEW.action_type,
        'latest_resource', NEW.resource_type,
        'timeframe', '1_hour'
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for sensitive data access monitoring
DROP TRIGGER IF EXISTS monitor_sensitive_access ON public.security_audit_log;
CREATE TRIGGER monitor_sensitive_access
  AFTER INSERT ON public.security_audit_log
  FOR EACH ROW
  WHEN (NEW.risk_level IN ('high', 'critical', 'elevated'))
  EXECUTE FUNCTION monitor_sensitive_data_access();

-- 7. Create function to validate all permissions at once
CREATE OR REPLACE FUNCTION public.validate_comprehensive_access(
  p_resource_type text,
  p_resource_id uuid,
  p_operation text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  CASE p_resource_type
    WHEN 'patient' THEN
      RETURN validate_patient_access_with_logging(p_resource_id, p_operation);
    WHEN 'call' THEN
      RETURN validate_call_transcript_access(p_resource_id, p_operation);
    WHEN 'office' THEN
      RETURN validate_pms_credential_access(p_resource_id, p_operation);
    ELSE
      RETURN false;
  END CASE;
END;
$$;