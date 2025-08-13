-- Fix patients table RLS policies to eliminate infinite recursion and ensure proper security

-- First, drop all existing policies on patients table
DROP POLICY IF EXISTS "Authorized staff can update patients" ON public.patients;
DROP POLICY IF EXISTS "Medical staff can create patients in their clinic" ON public.patients;
DROP POLICY IF EXISTS "Medical staff can view assigned patients only" ON public.patients;
DROP POLICY IF EXISTS "Only owners can delete patients" ON public.patients;
DROP POLICY IF EXISTS "Owners and doctors can view all clinic patients" ON public.patients;

-- Create a helper function to get user's assigned patient IDs (to avoid recursion)
CREATE OR REPLACE FUNCTION public.get_user_assigned_patient_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT ARRAY(
    SELECT DISTINCT appointments.patient_id
    FROM public.appointments
    WHERE appointments.clinic_id IN (
      SELECT profiles.clinic_id
      FROM public.profiles
      WHERE profiles.user_id = auth.uid()
    )
    UNION
    SELECT DISTINCT p.id
    FROM public.patients p
    JOIN public.calls c ON (p.phone = c.caller_phone)
    WHERE c.assigned_to = auth.uid()
  );
$$;

-- Create secure RLS policies for patients table

-- Policy 1: Clinic isolation - users can only access patients from their clinic
CREATE POLICY "Clinic isolation for patients"
ON public.patients
FOR ALL
USING (
  clinic_id IN (
    SELECT profiles.clinic_id
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
  )
);

-- Policy 2: Role-based SELECT access
CREATE POLICY "Role-based patient access"
ON public.patients
FOR SELECT
USING (
  -- Owners and doctors can see all patients in their clinic
  (public.get_current_user_role() = ANY (ARRAY['owner', 'doctor']))
  OR
  -- Other medical staff can only see assigned patients
  (
    public.get_current_user_role() = ANY (ARRAY['nurse', 'medical_assistant', 'admin'])
    AND id = ANY(public.get_user_assigned_patient_ids())
  )
);

-- Policy 3: INSERT - Medical staff can create patients
CREATE POLICY "Medical staff can create patients"
ON public.patients
FOR INSERT
WITH CHECK (
  clinic_id IN (
    SELECT profiles.clinic_id
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
  )
  AND public.get_current_user_role() = ANY (ARRAY['owner', 'doctor', 'nurse', 'medical_assistant', 'admin'])
);

-- Policy 4: UPDATE - Authorized staff can update patients
CREATE POLICY "Authorized staff can update patients"
ON public.patients
FOR UPDATE
USING (
  clinic_id IN (
    SELECT profiles.clinic_id
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
  )
  AND (
    -- Owners and doctors can update any patient in their clinic
    public.get_current_user_role() = ANY (ARRAY['owner', 'doctor'])
    OR
    -- Other staff can only update assigned patients
    (
      public.get_current_user_role() = ANY (ARRAY['nurse', 'medical_assistant', 'admin'])
      AND id = ANY(public.get_user_assigned_patient_ids())
    )
  )
);

-- Policy 5: DELETE - Only owners can delete patients
CREATE POLICY "Only owners can delete patients"
ON public.patients
FOR DELETE
USING (
  clinic_id IN (
    SELECT profiles.clinic_id
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
  )
  AND public.get_current_user_role() = 'owner'
);

-- Ensure RLS is enabled on patients table
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- Create additional security function to validate patient access
CREATE OR REPLACE FUNCTION public.user_can_access_patient(patient_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.patients
    WHERE id = patient_id
    AND clinic_id IN (
      SELECT profiles.clinic_id
      FROM public.profiles
      WHERE profiles.user_id = auth.uid()
    )
    AND (
      public.get_current_user_role() = ANY (ARRAY['owner', 'doctor'])
      OR (
        public.get_current_user_role() = ANY (ARRAY['nurse', 'medical_assistant', 'admin'])
        AND id = ANY(public.get_user_assigned_patient_ids())
      )
    )
  );
$$;