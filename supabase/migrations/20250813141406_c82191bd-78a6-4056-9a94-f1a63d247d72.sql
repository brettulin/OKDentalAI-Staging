-- Phase 1: Clean implementation - fix trigger issues first

-- Drop problematic security monitoring trigger
DROP TRIGGER IF EXISTS monitor_security_events_trigger ON public.security_audit_log;

-- Create simple service-role only function for PMS credentials
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

-- Revoke client access
REVOKE ALL ON FUNCTION private.get_pms_credentials FROM anon, authenticated;