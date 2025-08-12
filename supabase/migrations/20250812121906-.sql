-- Fix critical role escalation vulnerability
-- Remove role updates from profiles table and create secure role management

-- Drop existing policies that allow role updates
DROP POLICY IF EXISTS "users can update self profile" ON public.profiles;

-- Create new policy that excludes role updates
CREATE POLICY "users can update self profile (excluding role)" 
ON public.profiles 
FOR UPDATE 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid() AND role IS NOT DISTINCT FROM (SELECT role FROM public.profiles WHERE user_id = auth.uid()));

-- Create secure function for role management (only owners can change roles)
CREATE OR REPLACE FUNCTION public.update_user_role(target_user_id uuid, new_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Only owners can update roles
  IF (SELECT role FROM public.profiles WHERE user_id = auth.uid()) != 'owner' THEN
    RAISE EXCEPTION 'Only owners can update user roles';
  END IF;
  
  -- Prevent owners from changing their own role (prevent lockout)
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot change your own role';
  END IF;
  
  -- Update the role
  UPDATE public.profiles 
  SET role = new_role, updated_at = now()
  WHERE user_id = target_user_id;
  
  -- Log the role change
  INSERT INTO public.security_audit_log (
    clinic_id,
    user_id,
    action_type,
    resource_type,
    resource_id,
    metadata
  ) SELECT 
    p.clinic_id,
    auth.uid(),
    'role_updated',
    'user',
    target_user_id,
    jsonb_build_object('new_role', new_role, 'target_user', target_user_id)
  FROM public.profiles p 
  WHERE p.user_id = auth.uid();
END;
$$;