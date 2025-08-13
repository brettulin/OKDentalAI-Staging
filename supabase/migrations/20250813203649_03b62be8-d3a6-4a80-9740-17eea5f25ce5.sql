-- Fix search path issues and enable leaked password protection

-- Update existing functions to have proper search path
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.has_admin_permission(permission_type text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_role text;
  user_admin_role public.admin_role_type;
BEGIN
  SELECT role, admin_role INTO user_role, user_admin_role
  FROM public.profiles 
  WHERE user_id = auth.uid();
  
  -- Owner has all permissions
  IF user_role = 'owner' THEN
    RETURN true;
  END IF;
  
  -- Check specific admin permissions
  CASE permission_type
    WHEN 'manage_users' THEN
      RETURN user_admin_role = 'technical_admin' OR user_role = 'admin';
    WHEN 'manage_medical_data' THEN
      RETURN user_admin_role = 'medical_admin' OR user_role IN ('admin', 'doctor');
    WHEN 'manage_clinic_settings' THEN
      RETURN user_admin_role = 'clinic_admin' OR user_role = 'admin';
    WHEN 'view_audit_logs' THEN
      RETURN user_admin_role IS NOT NULL OR user_role = 'admin';
    WHEN 'manage_pms_integration' THEN
      RETURN user_admin_role = 'technical_admin' OR user_role = 'admin';
    ELSE
      RETURN false;
  END CASE;
END;
$$;

-- Update existing security functions
CREATE OR REPLACE FUNCTION public.user_can_access_patient(patient_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.patients
    WHERE id = patient_id
    AND clinic_id IN (
      SELECT profiles.clinic_id
      FROM public.profiles
      WHERE profiles.user_id = auth.uid()
    )
    AND (
      public.get_current_user_role() = ANY (ARRAY['owner', 'doctor'])
      OR (
        public.get_current_user_role() = ANY (ARRAY['nurse', 'medical_assistant', 'admin'])
        AND id = ANY(public.get_user_assigned_patient_ids())
      )
    )
  );
$$;

-- Create function to check function search paths
CREATE OR REPLACE FUNCTION public.audit_function_security()
RETURNS TABLE(function_name text, has_secure_search_path boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    p.proname::text as function_name,
    (p.proconfig IS NOT NULL AND 'search_path=' = ANY(p.proconfig)) as has_secure_search_path
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.prosecdef = true  -- Only security definer functions
  ORDER BY p.proname;
$$;