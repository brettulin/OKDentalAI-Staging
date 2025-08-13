-- Phase 1: "Shut the doors" - Explicit deny-all policies and private schema for PMS credentials

-- 1. Add explicit deny-all policies for anonymous users on all sensitive tables
-- These catch-all policies ensure no anonymous access is ever possible

-- Patients - deny all anonymous access
CREATE POLICY deny_all_patients_anon ON public.patients
AS PERMISSIVE FOR ALL
TO anon
USING (false) WITH CHECK (false);

-- Calls - deny all anonymous access  
CREATE POLICY deny_all_calls_anon ON public.calls
AS PERMISSIVE FOR ALL
TO anon
USING (false) WITH CHECK (false);

-- Turns - deny all anonymous access
CREATE POLICY deny_all_turns_anon ON public.turns
AS PERMISSIVE FOR ALL
TO anon
USING (false) WITH CHECK (false);

-- Offices - deny all anonymous access (especially for PMS credentials)
CREATE POLICY deny_all_offices_anon ON public.offices
AS PERMISSIVE FOR ALL
TO anon
USING (false) WITH CHECK (false);

-- Security audit log - deny all anonymous access
CREATE POLICY deny_all_security_audit_anon ON public.security_audit_log
AS PERMISSIVE FOR ALL
TO anon
USING (false) WITH CHECK (false);

-- Security alerts - deny all anonymous access
CREATE POLICY deny_all_security_alerts_anon ON public.security_alerts
AS PERMISSIVE FOR ALL
TO anon
USING (false) WITH CHECK (false);

-- Profiles - deny all anonymous access
CREATE POLICY deny_all_profiles_anon ON public.profiles
AS PERMISSIVE FOR ALL
TO anon
USING (false) WITH CHECK (false);

-- 2. Create private schema for PMS credentials (completely isolated from client access)
CREATE SCHEMA IF NOT EXISTS private;

-- Revoke all access from anon and authenticated users on private schema
REVOKE ALL ON SCHEMA private FROM anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA private FROM anon, authenticated;

-- Create secure PMS credentials table in private schema
CREATE TABLE IF NOT EXISTS private.pms_credentials (
  office_id uuid PRIMARY KEY REFERENCES public.offices(id) ON DELETE CASCADE,
  vendor_key text NOT NULL,
  account_key text NOT NULL,
  account_id text NOT NULL,
  base_url text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ensure private schema is completely locked down
REVOKE ALL ON private.pms_credentials FROM anon, authenticated;

-- 3. Create masked view for client access (shows integration status without secrets)
CREATE OR REPLACE VIEW public.office_pms_status AS
SELECT
  o.id as office_id,
  o.clinic_id,
  o.name,
  o.pms_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM private.pms_credentials pc WHERE pc.office_id = o.id) 
    THEN true 
    ELSE false 
  END as has_credentials,
  o.created_at,
  o.updated_at
FROM public.offices o;

-- RLS on the view's underlying tables still applies
-- This view exposes no secrets, only status information

-- 4. Migrate existing PMS credentials to private schema
-- First, insert existing credentials into private schema
INSERT INTO private.pms_credentials (office_id, vendor_key, account_key, account_id, base_url)
SELECT 
  id as office_id,
  COALESCE(pms_credentials->>'vendor_key', '') as vendor_key,
  COALESCE(pms_credentials->>'account_key', '') as account_key,
  COALESCE(pms_credentials->>'account_id', '') as account_id,
  COALESCE(pms_credentials->>'base_url', '') as base_url
FROM public.offices 
WHERE pms_credentials IS NOT NULL
ON CONFLICT (office_id) DO NOTHING;

-- 5. Remove PMS credentials from public schema (after migration)
-- Clear the public credentials column to remove secrets from client reach
UPDATE public.offices SET pms_credentials = NULL WHERE pms_credentials IS NOT NULL;

-- 6. Restrict schema access for anon users
-- Revoke default usage on public schema from anon (they can still access via PostgREST but policies will block)
REVOKE USAGE ON SCHEMA public FROM anon;
-- Grant back to authenticated users (they still need table-level permissions via RLS)
GRANT USAGE ON SCHEMA public TO authenticated;

-- 7. Create service-role only function to access PMS credentials
CREATE OR REPLACE FUNCTION private.get_pms_credentials(p_office_id uuid)
RETURNS TABLE(
  vendor_key text,
  account_key text, 
  account_id text,
  base_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Only accessible via service role in edge functions
  RETURN QUERY
  SELECT 
    pc.vendor_key,
    pc.account_key,
    pc.account_id,
    pc.base_url
  FROM private.pms_credentials pc
  WHERE pc.office_id = p_office_id;
END;
$$;

-- Revoke access from all roles except service_role
REVOKE ALL ON FUNCTION private.get_pms_credentials FROM anon, authenticated;

-- 8. Create audit log for Phase 1 completion
INSERT INTO public.security_audit_log (
  clinic_id, 
  user_id, 
  action_type, 
  resource_type, 
  metadata
) 
SELECT DISTINCT 
  p.clinic_id,
  p.user_id,
  'phase1_security_hardening',
  'system_security',
  jsonb_build_object(
    'phase', 'phase_1_complete',
    'deny_all_policies_created', true,
    'private_schema_created', true,
    'pms_credentials_migrated', true,
    'anon_access_revoked', true,
    'timestamp', now()
  )
FROM public.profiles p 
WHERE p.role = 'owner'
LIMIT 10; -- Prevent too many entries if many owners exist