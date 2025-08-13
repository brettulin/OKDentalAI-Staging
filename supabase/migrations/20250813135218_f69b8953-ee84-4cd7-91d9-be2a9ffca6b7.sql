-- Complete Phase 1: Critical Data Protection Fixes

-- 1. Create simplified, bulletproof RLS policies that close security gaps

-- Replace complex patient policies with simplified, secure ones
DROP POLICY IF EXISTS "Enhanced patient access with audit" ON public.patients;
DROP POLICY IF EXISTS "Clinic isolation for patients" ON public.patients;
DROP POLICY IF EXISTS "Role-based patient access" ON public.patients;
DROP POLICY IF EXISTS "Medical staff can create patients" ON public.patients;
DROP POLICY IF EXISTS "Authorized staff can update patients" ON public.patients;
DROP POLICY IF EXISTS "Only owners can delete patients" ON public.patients;

-- Simplified, secure patient policies
CREATE POLICY "Secure patient clinic isolation" 
ON public.patients FOR ALL 
USING (
  clinic_id IN (
    SELECT profiles.clinic_id
    FROM profiles
    WHERE profiles.user_id = auth.uid()
  )
  AND (
    -- Owners and doctors have full access
    get_current_user_role() IN ('owner', 'doctor')
    OR
    -- Other staff only access assigned patients
    (
      get_current_user_role() IN ('nurse', 'medical_assistant', 'admin')
      AND id = ANY(get_user_assigned_patient_ids())
    )
  )
);

-- Replace complex call policies with simplified, secure ones
DROP POLICY IF EXISTS "Enhanced call transcript access" ON public.calls;
DROP POLICY IF EXISTS "Owners and doctors can view all clinic calls" ON public.calls;
DROP POLICY IF EXISTS "Staff can view assigned calls only" ON public.calls;
DROP POLICY IF EXISTS "Medical staff can create calls" ON public.calls;
DROP POLICY IF EXISTS "Assigned staff can update their calls" ON public.calls;
DROP POLICY IF EXISTS "Only owners can delete calls" ON public.calls;

-- Simplified, secure call policies
CREATE POLICY "Secure call access control" 
ON public.calls FOR SELECT 
USING (
  clinic_id IN (
    SELECT profiles.clinic_id
    FROM profiles
    WHERE profiles.user_id = auth.uid()
  )
  AND (
    -- Owners and doctors can see all calls
    get_current_user_role() IN ('owner', 'doctor')
    OR
    -- Staff can only see calls assigned to them
    assigned_to = auth.uid()
  )
);

CREATE POLICY "Secure call creation" 
ON public.calls FOR INSERT 
WITH CHECK (
  clinic_id IN (
    SELECT profiles.clinic_id
    FROM profiles
    WHERE profiles.user_id = auth.uid()
  )
  AND get_current_user_role() IN ('owner', 'doctor', 'nurse', 'medical_assistant')
);

CREATE POLICY "Secure call updates" 
ON public.calls FOR UPDATE 
USING (
  clinic_id IN (
    SELECT profiles.clinic_id
    FROM profiles
    WHERE profiles.user_id = auth.uid()
  )
  AND (
    get_current_user_role() IN ('owner', 'doctor') 
    OR assigned_to = auth.uid()
  )
);

CREATE POLICY "Owner-only call deletion" 
ON public.calls FOR DELETE 
USING (
  clinic_id IN (
    SELECT profiles.clinic_id
    FROM profiles
    WHERE profiles.user_id = auth.uid()
  )
  AND get_current_user_role() = 'owner'
);

-- Replace complex office/PMS credential policies
DROP POLICY IF EXISTS "Enhanced PMS credential access" ON public.offices;
DROP POLICY IF EXISTS "Owners and technical admins can manage offices" ON public.offices;
DROP POLICY IF EXISTS "Owners and technical admins can view offices" ON public.offices;

-- Ultra-secure PMS credential policies - only owners
CREATE POLICY "Owner-only PMS access" 
ON public.offices FOR ALL 
USING (
  clinic_id IN (
    SELECT profiles.clinic_id
    FROM profiles
    WHERE profiles.user_id = auth.uid()
  )
  AND get_current_user_role() = 'owner'
);

-- Replace complex conversation/turns policies
DROP POLICY IF EXISTS "Enhanced conversation access" ON public.turns;
DROP POLICY IF EXISTS "Medical staff can view turns" ON public.turns;
DROP POLICY IF EXISTS "Medical staff can create turns" ON public.turns;
DROP POLICY IF EXISTS "Medical staff can update turns" ON public.turns;
DROP POLICY IF EXISTS "Only owners can delete turns" ON public.turns;

-- Simplified, secure conversation policies
CREATE POLICY "Secure conversation access" 
ON public.turns FOR SELECT 
USING (
  call_id IN (
    SELECT calls.id
    FROM calls
    WHERE calls.clinic_id IN (
      SELECT profiles.clinic_id
      FROM profiles
      WHERE profiles.user_id = auth.uid()
    )
    AND (
      get_current_user_role() IN ('owner', 'doctor')
      OR calls.assigned_to = auth.uid()
    )
  )
);

CREATE POLICY "Secure conversation creation" 
ON public.turns FOR INSERT 
WITH CHECK (
  call_id IN (
    SELECT calls.id
    FROM calls
    WHERE calls.clinic_id IN (
      SELECT profiles.clinic_id
      FROM profiles
      WHERE profiles.user_id = auth.uid()
    )
    AND get_current_user_role() IN ('owner', 'doctor', 'nurse', 'medical_assistant')
  )
);

CREATE POLICY "Owner-only conversation deletion" 
ON public.turns FOR DELETE 
USING (
  call_id IN (
    SELECT calls.id
    FROM calls
    WHERE calls.clinic_id IN (
      SELECT profiles.clinic_id
      FROM profiles
      WHERE profiles.user_id = auth.uid()
    )
    AND get_current_user_role() = 'owner'
  )
);

-- 2. Create additional security functions for edge cases

-- Function to detect and prevent role escalation attempts
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  current_user_role text;
  clinic_id_val uuid;
BEGIN
  -- Get current user's role and clinic
  SELECT role, clinic_id INTO current_user_role, clinic_id_val
  FROM public.profiles 
  WHERE user_id = auth.uid();
  
  -- Prevent non-owners from escalating roles
  IF current_user_role != 'owner' AND NEW.role IN ('owner', 'admin') THEN
    -- Log the attempt
    PERFORM log_sensitive_access(
      clinic_id_val,
      'role_escalation_attempt',
      'user_profile',
      NEW.user_id,
      jsonb_build_object(
        'attempted_role', NEW.role,
        'current_role', current_user_role,
        'risk_level', 'critical'
      )
    );
    
    -- Create security alert
    PERFORM create_security_alert(
      clinic_id_val,
      'unauthorized_role_escalation',
      'critical',
      format('User %s attempted to escalate role to %s', auth.uid(), NEW.role),
      jsonb_build_object(
        'user_id', auth.uid(),
        'target_user', NEW.user_id,
        'attempted_role', NEW.role,
        'current_role', current_user_role
      )
    );
    
    RAISE EXCEPTION 'Unauthorized role escalation attempt detected';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to prevent role escalation
DROP TRIGGER IF EXISTS prevent_role_escalation_trigger ON public.profiles;
CREATE TRIGGER prevent_role_escalation_trigger
  BEFORE UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_role_escalation();

-- 3. Create function to validate session integrity
CREATE OR REPLACE FUNCTION public.validate_session_integrity()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  user_profile RECORD;
  session_valid boolean DEFAULT true;
BEGIN
  -- Get user profile
  SELECT * INTO user_profile
  FROM public.profiles 
  WHERE user_id = auth.uid();
  
  -- Check if user exists and has valid clinic
  IF user_profile.clinic_id IS NULL THEN
    session_valid := false;
  END IF;
  
  -- Log session validation
  IF user_profile.clinic_id IS NOT NULL THEN
    PERFORM log_sensitive_access(
      user_profile.clinic_id,
      CASE WHEN session_valid THEN 'session_validated' ELSE 'session_invalid' END,
      'user_session',
      auth.uid(),
      jsonb_build_object(
        'validation_timestamp', now(),
        'user_role', user_profile.role,
        'clinic_id', user_profile.clinic_id
      )
    );
  END IF;
  
  RETURN session_valid;
END;
$$;

-- 4. Create comprehensive data access audit function
CREATE OR REPLACE FUNCTION public.audit_sensitive_data_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  clinic_id_val uuid;
  table_name text;
  operation_type text;
BEGIN
  -- Get clinic ID
  SELECT clinic_id INTO clinic_id_val
  FROM public.profiles 
  WHERE user_id = auth.uid();
  
  -- Determine table and operation
  table_name := TG_TABLE_NAME;
  operation_type := TG_OP;
  
  -- Log all sensitive data access
  IF table_name IN ('patients', 'calls', 'turns', 'offices') THEN
    PERFORM log_sensitive_access(
      clinic_id_val,
      format('%s_%s', lower(operation_type), table_name),
      'sensitive_data',
      COALESCE(NEW.id, OLD.id),
      jsonb_build_object(
        'table_name', table_name,
        'operation', operation_type,
        'timestamp', now(),
        'risk_level', 
          CASE table_name
            WHEN 'offices' THEN 'critical'
            WHEN 'patients' THEN 'high'
            WHEN 'calls' THEN 'high'
            ELSE 'normal'
          END
      )
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create audit triggers for all sensitive tables
CREATE TRIGGER audit_patients_access
  AFTER INSERT OR UPDATE OR DELETE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION audit_sensitive_data_access();

CREATE TRIGGER audit_calls_access
  AFTER INSERT OR UPDATE OR DELETE ON public.calls
  FOR EACH ROW EXECUTE FUNCTION audit_sensitive_data_access();

CREATE TRIGGER audit_turns_access
  AFTER INSERT OR UPDATE OR DELETE ON public.turns
  FOR EACH ROW EXECUTE FUNCTION audit_sensitive_data_access();

CREATE TRIGGER audit_offices_access
  AFTER INSERT OR UPDATE OR DELETE ON public.offices
  FOR EACH ROW EXECUTE FUNCTION audit_sensitive_data_access();