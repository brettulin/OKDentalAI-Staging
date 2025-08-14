-- Fix security warnings by setting proper search_path for security definer functions

-- 1. Fix link_creator_to_clinic function
CREATE OR REPLACE FUNCTION public.link_creator_to_clinic()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip profile creation if no authenticated user (for testing data)
  IF auth.uid() IS NOT NULL THEN
    INSERT INTO public.profiles (user_id, clinic_id, display_name, role)
    VALUES (auth.uid(), NEW.id, null, 'owner')
    ON CONFLICT (user_id) DO UPDATE
      SET clinic_id = EXCLUDED.clinic_id,
          role = EXCLUDED.role;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 2. Fix has_admin_permission function if it exists
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