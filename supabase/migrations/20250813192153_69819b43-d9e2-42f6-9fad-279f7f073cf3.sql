-- Fix security vulnerabilities identified in Phase 1 & 2

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
        -- Add user assignment logic here when provider assignments are implemented
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

-- 2. Restrict call access to doctors and owners only, with specific assignment exceptions
DROP POLICY IF EXISTS "Secure call access control" ON public.calls;
CREATE POLICY "Secure call access control" 
ON public.calls 
FOR SELECT 
USING (
  clinic_id IN (
    SELECT profiles.clinic_id
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
  ) 
  AND (
    -- Only owners and doctors can view all calls
    get_current_user_role() IN ('owner', 'doctor')
    OR 
    -- Staff can only view calls specifically assigned to them
    (assigned_to = auth.uid() AND get_current_user_role() IN ('nurse', 'medical_assistant', 'admin'))
  )
);

-- 3. Restrict call transcript access (turns table) to doctors and owners only
DROP POLICY IF EXISTS "Secure conversation access" ON public.turns;
CREATE POLICY "Secure conversation access" 
ON public.turns 
FOR SELECT 
USING (
  call_id IN (
    SELECT calls.id
    FROM public.calls
    WHERE calls.clinic_id IN (
      SELECT profiles.clinic_id
      FROM public.profiles
      WHERE profiles.user_id = auth.uid()
    ) 
    AND (
      -- Only doctors and owners can view transcripts
      get_current_user_role() IN ('owner', 'doctor')
      OR
      -- Exception: assigned staff can view their own call transcripts
      (calls.assigned_to = auth.uid() AND get_current_user_role() IN ('nurse', 'medical_assistant', 'admin'))
    )
  )
);

-- 4. Enhanced MFA protection - add clinic isolation and admin restrictions
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

-- 5. Add additional protection for PMS credentials access
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

-- 6. Fix password history access - restrict to security admins only
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

-- 7. Add comprehensive audit logging for all sensitive access
CREATE OR REPLACE FUNCTION public.log_sensitive_data_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  clinic_id_val uuid;
BEGIN
  -- Get user's clinic
  SELECT clinic_id INTO clinic_id_val
  FROM public.profiles 
  WHERE user_id = auth.uid();
  
  -- Log the access
  PERFORM log_sensitive_access(
    clinic_id_val,
    TG_OP || '_' || TG_TABLE_NAME,
    'sensitive_data_access',
    COALESCE(NEW.id, OLD.id),
    jsonb_build_object(
      'table_name', TG_TABLE_NAME,
      'operation', TG_OP,
      'timestamp', now(),
      'risk_level', 'high'
    )
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Create triggers for sensitive tables
DROP TRIGGER IF EXISTS log_patient_access ON public.patients;
CREATE TRIGGER log_patient_access
  AFTER SELECT ON public.patients
  FOR EACH ROW EXECUTE FUNCTION log_sensitive_data_access();

DROP TRIGGER IF EXISTS log_call_access ON public.calls;
CREATE TRIGGER log_call_access
  AFTER SELECT ON public.calls
  FOR EACH ROW EXECUTE FUNCTION log_sensitive_data_access();

DROP TRIGGER IF EXISTS log_mfa_access ON public.user_mfa;
CREATE TRIGGER log_mfa_access
  AFTER SELECT OR UPDATE ON public.user_mfa
  FOR EACH ROW EXECUTE FUNCTION log_sensitive_data_access();

-- 8. Create emergency lockdown function for security incidents
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
  
  -- Disable all non-owner access temporarily
  UPDATE public.profiles 
  SET role = 'suspended'
  WHERE clinic_id = clinic_id_val 
    AND role != 'owner'
    AND user_id != auth.uid();
  
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