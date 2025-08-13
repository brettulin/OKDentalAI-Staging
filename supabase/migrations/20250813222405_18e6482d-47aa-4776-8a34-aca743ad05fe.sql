-- Fix security issues
-- Update existing functions to have proper search_path
CREATE OR REPLACE FUNCTION public.is_platform_superadmin()
RETURNS boolean 
LANGUAGE sql 
STABLE 
SECURITY DEFINER 
SET search_path = 'public'
AS $$
  select exists(
    select 1 from platform_users
    where user_id = auth.uid() and role = 'superadmin'
  );
$$;

-- Update other functions that might need search_path
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid();
$$;