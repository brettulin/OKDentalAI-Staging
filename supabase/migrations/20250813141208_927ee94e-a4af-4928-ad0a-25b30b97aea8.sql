-- Phase 1: Simple implementation without problematic functions
-- Drop all problematic triggers and functions first

-- 1. Drop triggers that might cause issues
DROP TRIGGER IF EXISTS audit_sensitive_data_trigger ON public.offices;
DROP TRIGGER IF EXISTS audit_sensitive_data_trigger ON public.patients;
DROP TRIGGER IF EXISTS audit_sensitive_data_trigger ON public.calls;
DROP TRIGGER IF EXISTS audit_sensitive_data_trigger ON public.turns;

-- 2. Drop problematic function
DROP FUNCTION IF EXISTS public.audit_sensitive_data_access();

-- 3. Add explicit deny-all policies for anonymous users
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