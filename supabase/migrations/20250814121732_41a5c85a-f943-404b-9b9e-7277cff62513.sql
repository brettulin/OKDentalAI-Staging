-- Drop and recreate the has_admin_permission function with correct parameter name
DROP FUNCTION IF EXISTS public.has_admin_permission(text);

CREATE OR REPLACE FUNCTION public.has_admin_permission(permission_name text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
    AND admin_role IS NOT NULL
    AND (
      admin_role = 'technical_admin' OR
      (admin_role = 'security_admin' AND permission_name IN ('view_audit_logs', 'manage_security')) OR
      (admin_role = 'compliance_admin' AND permission_name IN ('manage_clinic_settings', 'view_audit_logs'))
    )
  );
$$;