-- Step 3: Role-based Permissions & Admin Controls
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

-- Create admin permissions table for tracking
CREATE TABLE public.admin_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  permission_name TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;

-- Create policy for viewing permissions
CREATE POLICY "Authenticated users can view admin permissions" 
ON public.admin_permissions 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Insert standard admin permissions
INSERT INTO public.admin_permissions (permission_name, description, category) VALUES
('manage_clinic_settings', 'Manage clinic configuration and settings', 'clinic'),
('manage_integrations', 'Manage PMS and external integrations', 'technical'),
('view_audit_logs', 'View security and audit logs', 'security'),
('manage_security', 'Manage security settings and policies', 'security'),
('manage_incidents', 'Manage security incidents and responses', 'security'),
('manage_compliance', 'Manage compliance frameworks and assessments', 'compliance'),
('generate_reports', 'Generate and export compliance reports', 'compliance'),
('manage_users', 'Manage user accounts and permissions', 'users'),
('manage_clinical_data', 'Manage patient data and clinical records', 'clinical'),
('view_reports', 'View analytics and performance reports', 'reporting');

-- Update existing functions to fix search path warnings
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid();
$$;

-- Create function to validate role-based access
CREATE OR REPLACE FUNCTION public.validate_role_access(required_roles text[])
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_role text;
BEGIN
  SELECT get_current_user_role() INTO current_role;
  RETURN current_role = ANY(required_roles);
END;
$$;