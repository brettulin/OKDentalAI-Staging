-- Step 3: Role-based Permissions & Admin Controls (Fixed)
-- Drop existing function first to avoid conflicts
DROP FUNCTION IF EXISTS public.has_admin_permission(text);

-- Create has_admin_permission function for granular admin permissions
CREATE OR REPLACE FUNCTION public.has_admin_permission(permission_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_admin_role admin_role_type;
  user_role text;
BEGIN
  -- Get user's role and admin_role
  SELECT role, admin_role INTO user_role, user_admin_role
  FROM public.profiles 
  WHERE user_id = auth.uid();
  
  -- Owner has all permissions
  IF user_role = 'owner' THEN
    RETURN true;
  END IF;
  
  -- Check admin role permissions
  CASE user_admin_role
    WHEN 'technical_admin' THEN
      RETURN permission_name IN (
        'manage_clinic_settings',
        'manage_integrations', 
        'view_audit_logs',
        'manage_security'
      );
    WHEN 'security_admin' THEN
      RETURN permission_name IN (
        'view_audit_logs',
        'manage_security',
        'manage_incidents'
      );
    WHEN 'compliance_admin' THEN
      RETURN permission_name IN (
        'view_audit_logs',
        'manage_compliance',
        'generate_reports'
      );
    WHEN 'clinical_admin' THEN
      RETURN permission_name IN (
        'manage_users',
        'manage_clinical_data',
        'view_reports'
      );
    ELSE
      RETURN false;
  END CASE;
END;
$$;