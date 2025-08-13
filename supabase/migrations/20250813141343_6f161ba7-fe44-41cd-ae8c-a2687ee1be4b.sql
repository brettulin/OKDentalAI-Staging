-- Phase 1: Complete with service-role only PMS credentials function

-- Create service-role only function to access PMS credentials
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

-- Revoke all access from client roles
REVOKE ALL ON FUNCTION private.get_pms_credentials FROM anon, authenticated;

-- Log Phase 1 completion in security audit
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
  'phase1_security_hardening_complete',
  'system_security',
  jsonb_build_object(
    'phase', 'phase_1_complete',
    'deny_all_policies_created', true,
    'private_schema_created', true,
    'pms_credentials_migrated', true,
    'anon_access_blocked', true,
    'service_role_function_created', true,
    'timestamp', now()
  )
FROM public.profiles p 
WHERE p.role = 'owner'
LIMIT 5;