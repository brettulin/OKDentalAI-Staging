-- PHASE 4.1: CRITICAL SECURITY VULNERABILITY FIXES (PART 2)
-- Fix RLS policies for all security vulnerabilities

-- 3. Fix Patient Medical Records Exposure (lov_PUBLIC_PATIENT_DATA)
-- Enhance RLS policies for patients table to prevent anonymous access
DROP POLICY IF EXISTS "Secure patient clinic isolation" ON public.patients;

CREATE POLICY "Secure authenticated patient access only" 
ON public.patients 
FOR ALL
USING (
  -- Require authentication
  auth.uid() IS NOT NULL 
  AND
  -- Clinic isolation
  clinic_id IN (
    SELECT profiles.clinic_id
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
  ) 
  AND 
  -- Role-based access with strict patient assignment
  (
    -- Owners and doctors have full access
    get_current_user_role() = ANY (ARRAY['owner', 'doctor'])
    OR 
    -- Other staff only access assigned patients
    (
      get_current_user_role() = ANY (ARRAY['nurse', 'medical_assistant', 'admin'])
      AND id = ANY (get_user_assigned_patient_ids())
    )
  )
)
WITH CHECK (
  -- Same check for inserts/updates
  auth.uid() IS NOT NULL 
  AND
  clinic_id IN (
    SELECT profiles.clinic_id
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
  )
  AND
  get_current_user_role() = ANY (ARRAY['owner', 'doctor', 'nurse', 'medical_assistant', 'admin'])
);

-- 4. Fix Medical Call Recordings Exposure (lov_EXPOSED_CALL_TRANSCRIPTS)
-- Enhance RLS policies for calls and turns tables
DROP POLICY IF EXISTS "Secure call access control" ON public.calls;
DROP POLICY IF EXISTS "Secure call creation" ON public.calls;
DROP POLICY IF EXISTS "Secure call updates" ON public.calls;

CREATE POLICY "Ultra secure call access" 
ON public.calls 
FOR SELECT
USING (
  -- Require authentication
  auth.uid() IS NOT NULL
  AND
  -- Clinic isolation
  clinic_id IN (
    SELECT profiles.clinic_id
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
  ) 
  AND 
  -- Strict role-based access
  (
    get_current_user_role() = ANY (ARRAY['owner', 'doctor'])
    OR 
    (assigned_to = auth.uid() AND get_current_user_role() = ANY (ARRAY['nurse', 'medical_assistant', 'admin']))
  )
);

CREATE POLICY "Ultra secure call creation" 
ON public.calls 
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
  get_current_user_role() = ANY (ARRAY['owner', 'doctor', 'nurse', 'medical_assistant'])
);

CREATE POLICY "Ultra secure call updates" 
ON public.calls 
FOR UPDATE
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
    get_current_user_role() = ANY (ARRAY['owner', 'doctor'])
    OR 
    (assigned_to = auth.uid() AND get_current_user_role() = ANY (ARRAY['nurse', 'medical_assistant']))
  )
);

-- Update turns table policy
DROP POLICY IF EXISTS "Secure conversation access" ON public.turns;
DROP POLICY IF EXISTS "Secure conversation creation" ON public.turns;

CREATE POLICY "Ultra secure conversation access" 
ON public.turns 
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND
  call_id IN (
    SELECT calls.id
    FROM public.calls
    WHERE calls.clinic_id IN (
      SELECT profiles.clinic_id
      FROM public.profiles
      WHERE profiles.user_id = auth.uid()
    ) 
    AND (
      get_current_user_role() = ANY (ARRAY['owner', 'doctor'])
      OR 
      (calls.assigned_to = auth.uid() AND get_current_user_role() = ANY (ARRAY['nurse', 'medical_assistant', 'admin']))
    )
  )
);

CREATE POLICY "Ultra secure conversation creation" 
ON public.turns 
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND
  call_id IN (
    SELECT calls.id
    FROM public.calls
    WHERE calls.clinic_id IN (
      SELECT profiles.clinic_id
      FROM public.profiles
      WHERE profiles.user_id = auth.uid()
    )
    AND get_current_user_role() = ANY (ARRAY['owner', 'doctor', 'nurse', 'medical_assistant'])
  )
);