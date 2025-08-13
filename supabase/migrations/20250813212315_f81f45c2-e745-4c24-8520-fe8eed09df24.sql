-- PHASE 4.1: CRITICAL SECURITY VULNERABILITY FIXES (PART 3)
-- Continue fixing remaining security vulnerabilities

-- 5. Fix Healthcare Facility Information Exposure (lov_PUBLIC_CLINIC_DATA)
-- Enhance RLS policies for clinics, locations, and offices tables
DROP POLICY IF EXISTS "auth can select clinics" ON public.clinics;
DROP POLICY IF EXISTS "auth can insert clinics" ON public.clinics;

CREATE POLICY "Authenticated users can view own clinic" 
ON public.clinics 
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND
  id IN (
    SELECT profiles.clinic_id
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
  )
);

CREATE POLICY "Authenticated users can create clinic" 
ON public.clinics 
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
);

-- 6. Fix Security Audit Trails Tampering (lov_EXPOSED_SECURITY_LOGS)
-- Enhance security for all security-related tables
DROP POLICY IF EXISTS "Secure audit log access" ON public.security_audit_log;
DROP POLICY IF EXISTS "Authenticated users can create audit logs" ON public.security_audit_log;
DROP POLICY IF EXISTS "Secure audit log creation" ON public.security_audit_log;

CREATE POLICY "Security admins only audit log access" 
ON public.security_audit_log 
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND
  clinic_id IN (
    SELECT profiles.clinic_id
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
  ) 
  AND 
  (
    get_current_user_role() = 'owner'
    OR 
    has_admin_permission('view_audit_logs')
  )
);

CREATE POLICY "System only audit log creation" 
ON public.security_audit_log 
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND
  clinic_id IN (
    SELECT profiles.clinic_id
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
  )
  AND
  user_id = auth.uid()
);

-- 7. Fix User Authentication Data Compromise (lov_PUBLIC_USER_SESSIONS)
-- Enhance RLS policies for session and MFA tables
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "System can insert sessions" ON public.user_sessions;

CREATE POLICY "Strict user session access" 
ON public.user_sessions 
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND
  user_id = auth.uid()
);

CREATE POLICY "Strict user session updates" 
ON public.user_sessions 
FOR UPDATE
USING (
  auth.uid() IS NOT NULL
  AND
  user_id = auth.uid()
);

CREATE POLICY "Strict user session creation" 
ON public.user_sessions 
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND
  user_id = auth.uid()
);

-- Enhanced user sessions - only session owner can access
DROP POLICY IF EXISTS "Users can manage their own enhanced sessions" ON public.enhanced_user_sessions;

CREATE POLICY "Strict enhanced session access" 
ON public.enhanced_user_sessions 
FOR ALL
USING (
  auth.uid() IS NOT NULL
  AND
  user_id = auth.uid()
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND
  user_id = auth.uid()
);

-- User MFA - only MFA owner can access
DROP POLICY IF EXISTS "Users can view their own MFA" ON public.user_mfa;
DROP POLICY IF EXISTS "Users can update their own MFA" ON public.user_mfa;
DROP POLICY IF EXISTS "Users can insert their own MFA" ON public.user_mfa;

CREATE POLICY "Strict MFA access" 
ON public.user_mfa 
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND
  user_id = auth.uid()
);

CREATE POLICY "Strict MFA updates" 
ON public.user_mfa 
FOR UPDATE
USING (
  auth.uid() IS NOT NULL
  AND
  user_id = auth.uid()
  AND
  clinic_id IN (
    SELECT profiles.clinic_id
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
  )
);

CREATE POLICY "Strict MFA creation" 
ON public.user_mfa 
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND
  user_id = auth.uid()
  AND
  clinic_id IN (
    SELECT profiles.clinic_id
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
  )
);