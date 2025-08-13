-- PHASE 4.1: CRITICAL SECURITY VULNERABILITY FIXES (PART 1)
-- Fix function naming conflict first, then implement security fixes

-- 1. Fix Function Search Path Issues (SUPA_function_search_path_mutable)
-- Drop and recreate the function with proper search path
DROP FUNCTION IF EXISTS public.has_admin_permission(text);

CREATE OR REPLACE FUNCTION public.has_admin_permission(permission_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_admin_role admin_role_type;
BEGIN
  SELECT admin_role INTO user_admin_role
  FROM public.profiles 
  WHERE user_id = auth.uid();
  
  -- Check admin permissions based on role
  CASE user_admin_role
    WHEN 'technical_admin' THEN
      RETURN permission_name IN ('manage_clinic_settings', 'view_audit_logs', 'manage_integrations');
    WHEN 'security_admin' THEN  
      RETURN permission_name IN ('view_audit_logs', 'manage_users', 'manage_security');
    WHEN 'clinical_admin' THEN
      RETURN permission_name IN ('manage_providers', 'manage_patients', 'view_reports');
    WHEN 'operational_admin' THEN
      RETURN permission_name IN ('manage_appointments', 'manage_clinic_settings');
    ELSE
      RETURN false;
  END CASE;
END;
$function$;

-- 2. Create leaked password protection reminder function
CREATE OR REPLACE FUNCTION public.security_reminder_leaked_password_protection()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 'REMINDER: Enable leaked password protection in Supabase Auth settings'::text;
$function$;