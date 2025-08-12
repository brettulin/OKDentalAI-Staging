-- ===========================================================================
-- CRITICAL SECURITY FIXES FOR PRODUCTION READINESS (CORRECTED)
-- ===========================================================================

-- 1. ENHANCED RLS POLICIES FOR PATIENT DATA PROTECTION
-- Replace existing permissive patient policies with strict role and clinic-based access

-- Drop existing patient policies
DROP POLICY IF EXISTS "Medical staff can view patients" ON public.patients;
DROP POLICY IF EXISTS "Medical staff can create patients" ON public.patients;
DROP POLICY IF EXISTS "Medical staff can update patients" ON public.patients;
DROP POLICY IF EXISTS "Only owners can delete patients" ON public.patients;

-- Create enhanced patient access policies with stricter controls
CREATE POLICY "Owners and doctors can view all clinic patients" 
ON public.patients 
FOR SELECT 
USING (
  clinic_id IN (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid()) 
  AND get_current_user_role() IN ('owner', 'doctor')
);

CREATE POLICY "Medical staff can view assigned patients only" 
ON public.patients 
FOR SELECT 
USING (
  clinic_id IN (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid()) 
  AND get_current_user_role() IN ('nurse', 'medical_assistant', 'admin')
  AND (
    -- Allow access to patients they created or were assigned to
    id IN (
      SELECT DISTINCT patient_id FROM public.appointments 
      WHERE clinic_id IN (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid())
    )
    OR id IN (
      SELECT DISTINCT patients.id FROM public.patients
      JOIN public.calls ON patients.phone = calls.caller_phone
      WHERE calls.assigned_to = auth.uid()
    )
  )
);

CREATE POLICY "Medical staff can create patients in their clinic" 
ON public.patients 
FOR INSERT 
WITH CHECK (
  clinic_id IN (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid())
  AND get_current_user_role() IN ('owner', 'doctor', 'nurse', 'medical_assistant', 'admin')
);

CREATE POLICY "Authorized staff can update patients" 
ON public.patients 
FOR UPDATE 
USING (
  clinic_id IN (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid())
  AND (
    get_current_user_role() IN ('owner', 'doctor') 
    OR (
      get_current_user_role() IN ('nurse', 'medical_assistant', 'admin')
      AND id IN (
        SELECT DISTINCT patient_id FROM public.appointments 
        WHERE clinic_id IN (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid())
      )
    )
  )
);

CREATE POLICY "Only owners can delete patients" 
ON public.patients 
FOR DELETE 
USING (
  clinic_id IN (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid())
  AND get_current_user_role() = 'owner'
);

-- 2. ENHANCED CALL TRANSCRIPT SECURITY
-- Replace existing call policies with role-based access controls

-- Drop existing call policies
DROP POLICY IF EXISTS "Medical staff can view calls" ON public.calls;
DROP POLICY IF EXISTS "Medical staff can create calls" ON public.calls;
DROP POLICY IF EXISTS "Medical staff can update calls" ON public.calls;
DROP POLICY IF EXISTS "Only owners can delete calls" ON public.calls;

-- Create enhanced call access policies
CREATE POLICY "Owners and doctors can view all clinic calls" 
ON public.calls 
FOR SELECT 
USING (
  clinic_id IN (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid())
  AND get_current_user_role() IN ('owner', 'doctor')
);

CREATE POLICY "Staff can view assigned calls only" 
ON public.calls 
FOR SELECT 
USING (
  clinic_id IN (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid())
  AND (
    assigned_to = auth.uid() 
    OR get_current_user_role() IN ('owner', 'doctor')
  )
);

CREATE POLICY "Medical staff can create calls" 
ON public.calls 
FOR INSERT 
WITH CHECK (
  clinic_id IN (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid())
  AND get_current_user_role() IN ('owner', 'doctor', 'nurse', 'medical_assistant')
);

CREATE POLICY "Assigned staff can update their calls" 
ON public.calls 
FOR UPDATE 
USING (
  clinic_id IN (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid())
  AND (
    assigned_to = auth.uid() 
    OR get_current_user_role() IN ('owner', 'doctor')
  )
);

CREATE POLICY "Only owners can delete calls" 
ON public.calls 
FOR DELETE 
USING (
  clinic_id IN (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid())
  AND get_current_user_role() = 'owner'
);

-- 3. RESTRICT PMS CREDENTIALS ACCESS
-- Drop existing office policies  
DROP POLICY IF EXISTS "Clinic isolation policy" ON public.offices;

-- Create restricted access for PMS credentials
CREATE POLICY "Owners and technical admins can view offices" 
ON public.offices 
FOR SELECT 
USING (
  clinic_id IN (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid())
  AND (
    get_current_user_role() = 'owner' 
    OR has_admin_permission('manage_pms_integration')
  )
);

CREATE POLICY "Owners and technical admins can manage offices" 
ON public.offices 
FOR ALL 
USING (
  clinic_id IN (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid())
  AND (
    get_current_user_role() = 'owner' 
    OR has_admin_permission('manage_pms_integration')
  )
);

-- 4. SECURE AUDIT LOG CREATION
-- Drop existing permissive audit log policy
DROP POLICY IF EXISTS "System can create audit logs" ON public.security_audit_log;

-- Create secure audit log policy that requires valid user context
CREATE POLICY "Authenticated users can create audit logs" 
ON public.security_audit_log 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL
  AND clinic_id IN (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid())
);

-- 5. ENHANCED PROFILE SECURITY
-- Update profile policies to prevent unauthorized role changes
DROP POLICY IF EXISTS "Admin role management" ON public.profiles;

CREATE POLICY "Restricted admin role management" 
ON public.profiles 
FOR UPDATE 
USING (
  user_id = auth.uid() 
  OR (
    get_current_user_role() = 'owner' 
    AND user_id != auth.uid() -- Prevent self-modification
  )
  OR (
    has_admin_permission('manage_users')
    AND user_id != auth.uid() -- Prevent self-modification
    AND (SELECT role FROM public.profiles WHERE user_id = user_id) != 'owner' -- Can't modify owners
  )
)
WITH CHECK (
  user_id = auth.uid() 
  OR (
    get_current_user_role() = 'owner'
    AND user_id != auth.uid()
  )
  OR (
    has_admin_permission('manage_users')
    AND user_id != auth.uid()
    AND (SELECT role FROM public.profiles WHERE user_id = user_id) != 'owner'
  )
);