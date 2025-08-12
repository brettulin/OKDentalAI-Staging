-- Phase 2: Configuration Hardening and Access Control Improvements
-- Fix remaining function search path issues and strengthen role-based access

-- Fix remaining functions with mutable search paths
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_expired_holds()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.slots 
  SET status = 'open', held_until = NULL
  WHERE status = 'held' 
    AND held_until IS NOT NULL 
    AND held_until < now();
END;
$$;

-- Create enhanced role system with separation of concerns
CREATE TYPE public.admin_role_type AS ENUM ('technical_admin', 'medical_admin', 'clinic_admin');

-- Add admin_role column to profiles for enhanced role separation
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS admin_role public.admin_role_type;

-- Create function to check admin permissions with granular control
CREATE OR REPLACE FUNCTION public.has_admin_permission(permission_type text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
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

-- Enhanced security audit logging function for administrative actions
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action_type text,
  p_resource_type text,
  p_resource_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  clinic_id_val uuid;
BEGIN
  -- Get clinic_id for current user
  SELECT clinic_id INTO clinic_id_val
  FROM public.profiles 
  WHERE user_id = auth.uid();
  
  IF clinic_id_val IS NULL THEN
    RAISE EXCEPTION 'User not associated with a clinic';
  END IF;
  
  -- Insert enhanced audit log entry
  INSERT INTO public.security_audit_log (
    clinic_id,
    user_id,
    action_type,
    resource_type,
    resource_id,
    risk_level,
    metadata
  ) VALUES (
    clinic_id_val,
    auth.uid(),
    p_action_type,
    p_resource_type,
    p_resource_id,
    CASE 
      WHEN p_action_type IN ('delete_patient', 'export_data', 'role_change', 'pms_credential_access') THEN 'elevated'
      WHEN p_action_type LIKE '%admin%' THEN 'high'
      ELSE 'normal'
    END,
    jsonb_build_object(
      'timestamp', now(),
      'user_agent', current_setting('request.headers', true)::jsonb->>'user-agent',
      'ip_address', current_setting('request.headers', true)::jsonb->>'x-forwarded-for'
    ) || p_metadata
  );
END;
$$;

-- Update security policies for enhanced admin role separation
DROP POLICY IF EXISTS "Owners and admins can view security audit logs" ON public.security_audit_log;

CREATE POLICY "Enhanced admin access to security audit logs" 
ON public.security_audit_log 
FOR SELECT 
USING (
  clinic_id IN (
    SELECT clinic_id 
    FROM public.profiles 
    WHERE user_id = auth.uid()
  ) 
  AND (
    get_current_user_role() = 'owner' 
    OR has_admin_permission('view_audit_logs')
  )
);

-- Create policy for admin role management (only owners and technical admins)
CREATE POLICY "Admin role management" 
ON public.profiles 
FOR UPDATE 
USING (
  user_id = auth.uid() 
  OR (
    get_current_user_role() = 'owner' 
    OR has_admin_permission('manage_users')
  )
)
WITH CHECK (
  user_id = auth.uid() 
  OR (
    get_current_user_role() = 'owner' 
    OR has_admin_permission('manage_users')
  )
);

-- Function to safely update admin roles (principle of least privilege)
CREATE OR REPLACE FUNCTION public.update_admin_role(
  target_user_id uuid, 
  new_admin_role public.admin_role_type
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_role text;
  target_user_role text;
BEGIN
  -- Check permissions
  SELECT role INTO current_user_role 
  FROM public.profiles 
  WHERE user_id = auth.uid();
  
  SELECT role INTO target_user_role 
  FROM public.profiles 
  WHERE user_id = target_user_id;
  
  -- Only owners and technical admins can modify admin roles
  IF current_user_role != 'owner' AND NOT has_admin_permission('manage_users') THEN
    RAISE EXCEPTION 'Insufficient permissions to modify admin roles';
  END IF;
  
  -- Prevent modification of owner role
  IF target_user_role = 'owner' THEN
    RAISE EXCEPTION 'Cannot modify admin role for owner';
  END IF;
  
  -- Prevent self-modification for non-owners
  IF target_user_id = auth.uid() AND current_user_role != 'owner' THEN
    RAISE EXCEPTION 'Cannot modify your own admin role';
  END IF;
  
  -- Update admin role
  UPDATE public.profiles 
  SET admin_role = new_admin_role, updated_at = now()
  WHERE user_id = target_user_id;
  
  -- Log the admin role change
  PERFORM log_admin_action(
    'admin_role_updated',
    'user',
    target_user_id,
    jsonb_build_object(
      'new_admin_role', new_admin_role,
      'target_user', target_user_id,
      'previous_role', target_user_role
    )
  );
END;
$$;