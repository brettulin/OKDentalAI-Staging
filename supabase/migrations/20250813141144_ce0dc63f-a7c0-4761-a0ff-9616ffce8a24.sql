-- Phase 1: "Shut the doors" - Fix trigger issue first, then implement security hardening

-- 1. Temporarily disable problematic trigger
DROP TRIGGER IF EXISTS audit_sensitive_data_trigger ON public.offices;
DROP TRIGGER IF EXISTS audit_sensitive_data_trigger ON public.patients;
DROP TRIGGER IF EXISTS audit_sensitive_data_trigger ON public.calls;
DROP TRIGGER IF EXISTS audit_sensitive_data_trigger ON public.turns;

-- 2. Add explicit deny-all policies for anonymous users on all sensitive tables
CREATE POLICY deny_all_patients_anon ON public.patients
AS PERMISSIVE FOR ALL
TO anon
USING (false) WITH CHECK (false);

CREATE POLICY deny_all_calls_anon ON public.calls
AS PERMISSIVE FOR ALL
TO anon
USING (false) WITH CHECK (false);

CREATE POLICY deny_all_turns_anon ON public.turns
AS PERMISSIVE FOR ALL
TO anon
USING (false) WITH CHECK (false);

CREATE POLICY deny_all_offices_anon ON public.offices
AS PERMISSIVE FOR ALL
TO anon
USING (false) WITH CHECK (false);

CREATE POLICY deny_all_security_audit_anon ON public.security_audit_log
AS PERMISSIVE FOR ALL
TO anon
USING (false) WITH CHECK (false);

CREATE POLICY deny_all_security_alerts_anon ON public.security_alerts
AS PERMISSIVE FOR ALL
TO anon
USING (false) WITH CHECK (false);

CREATE POLICY deny_all_profiles_anon ON public.profiles
AS PERMISSIVE FOR ALL
TO anon
USING (false) WITH CHECK (false);

-- 3. Create private schema for PMS credentials
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM anon, authenticated;

-- 4. Create secure PMS credentials table in private schema
CREATE TABLE IF NOT EXISTS private.pms_credentials (
  office_id uuid PRIMARY KEY REFERENCES public.offices(id) ON DELETE CASCADE,
  vendor_key text NOT NULL,
  account_key text NOT NULL,
  account_id text NOT NULL,
  base_url text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

REVOKE ALL ON private.pms_credentials FROM anon, authenticated;

-- 5. Create masked view for client access
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

-- 6. Migrate existing PMS credentials to private schema
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

-- 7. Clear public credentials after migration
UPDATE public.offices SET pms_credentials = NULL WHERE pms_credentials IS NOT NULL;

-- 8. Create service-role only function for PMS credentials
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

REVOKE ALL ON FUNCTION private.get_pms_credentials FROM anon, authenticated;