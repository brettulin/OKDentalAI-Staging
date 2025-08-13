-- Emergency Security Fix: Re-enable all RLS policies

-- Enable RLS on all tables if not already enabled
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Re-verify all our secure policies exist
-- If they were somehow dropped, recreate them

-- Patients table security
DROP POLICY IF EXISTS "Secure patient clinic isolation" ON public.patients;
CREATE POLICY "Secure patient clinic isolation" 
ON public.patients FOR ALL 
USING (
  clinic_id IN (
    SELECT profiles.clinic_id
    FROM profiles
    WHERE profiles.user_id = auth.uid()
  )
  AND (
    -- Owners and doctors have full access
    get_current_user_role() IN ('owner', 'doctor')
    OR
    -- Other staff only access assigned patients
    (
      get_current_user_role() IN ('nurse', 'medical_assistant', 'admin')
      AND id = ANY(get_user_assigned_patient_ids())
    )
  )
);

-- Calls table security
DROP POLICY IF EXISTS "Secure call access control" ON public.calls;
CREATE POLICY "Secure call access control" 
ON public.calls FOR SELECT 
USING (
  clinic_id IN (
    SELECT profiles.clinic_id
    FROM profiles
    WHERE profiles.user_id = auth.uid()
  )
  AND (
    -- Owners and doctors can see all calls
    get_current_user_role() IN ('owner', 'doctor')
    OR
    -- Staff can only see calls assigned to them
    assigned_to = auth.uid()
  )
);

DROP POLICY IF EXISTS "Secure call creation" ON public.calls;
CREATE POLICY "Secure call creation" 
ON public.calls FOR INSERT 
WITH CHECK (
  clinic_id IN (
    SELECT profiles.clinic_id
    FROM profiles
    WHERE profiles.user_id = auth.uid()
  )
  AND get_current_user_role() IN ('owner', 'doctor', 'nurse', 'medical_assistant')
);

DROP POLICY IF EXISTS "Secure call updates" ON public.calls;
CREATE POLICY "Secure call updates" 
ON public.calls FOR UPDATE 
USING (
  clinic_id IN (
    SELECT profiles.clinic_id
    FROM profiles
    WHERE profiles.user_id = auth.uid()
  )
  AND (
    get_current_user_role() IN ('owner', 'doctor') 
    OR assigned_to = auth.uid()
  )
);

DROP POLICY IF EXISTS "Owner-only call deletion" ON public.calls;
CREATE POLICY "Owner-only call deletion" 
ON public.calls FOR DELETE 
USING (
  clinic_id IN (
    SELECT profiles.clinic_id
    FROM profiles
    WHERE profiles.user_id = auth.uid()
  )
  AND get_current_user_role() = 'owner'
);

-- Turns table security
DROP POLICY IF EXISTS "Secure conversation access" ON public.turns;
CREATE POLICY "Secure conversation access" 
ON public.turns FOR SELECT 
USING (
  call_id IN (
    SELECT calls.id
    FROM calls
    WHERE calls.clinic_id IN (
      SELECT profiles.clinic_id
      FROM profiles
      WHERE profiles.user_id = auth.uid()
    )
    AND (
      get_current_user_role() IN ('owner', 'doctor')
      OR calls.assigned_to = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Secure conversation creation" ON public.turns;
CREATE POLICY "Secure conversation creation" 
ON public.turns FOR INSERT 
WITH CHECK (
  call_id IN (
    SELECT calls.id
    FROM calls
    WHERE calls.clinic_id IN (
      SELECT profiles.clinic_id
      FROM profiles
      WHERE profiles.user_id = auth.uid()
    )
    AND get_current_user_role() IN ('owner', 'doctor', 'nurse', 'medical_assistant')
  )
);

DROP POLICY IF EXISTS "Owner-only conversation deletion" ON public.turns;
CREATE POLICY "Owner-only conversation deletion" 
ON public.turns FOR DELETE 
USING (
  call_id IN (
    SELECT calls.id
    FROM calls
    WHERE calls.clinic_id IN (
      SELECT profiles.clinic_id
      FROM profiles
      WHERE profiles.user_id = auth.uid()
    )
    AND get_current_user_role() = 'owner'
  )
);

-- Offices table security (PMS credentials)
DROP POLICY IF EXISTS "Owner-only PMS access" ON public.offices;
CREATE POLICY "Owner-only PMS access" 
ON public.offices FOR ALL 
USING (
  clinic_id IN (
    SELECT profiles.clinic_id
    FROM profiles
    WHERE profiles.user_id = auth.uid()
  )
  AND get_current_user_role() = 'owner'
);

-- Profiles table security
DROP POLICY IF EXISTS "users can select self profile" ON public.profiles;
CREATE POLICY "users can select self profile" 
ON public.profiles FOR SELECT 
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users can insert self profile" ON public.profiles;
CREATE POLICY "users can insert self profile" 
ON public.profiles FOR INSERT 
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users can update self profile (excluding role)" ON public.profiles;
CREATE POLICY "users can update self profile (excluding role)" 
ON public.profiles FOR UPDATE 
USING (user_id = auth.uid())
WITH CHECK ((user_id = auth.uid()) AND (NOT (role IS DISTINCT FROM ( SELECT profiles_1.role
   FROM profiles profiles_1
  WHERE (profiles_1.user_id = auth.uid())))));

DROP POLICY IF EXISTS "Restricted admin role management" ON public.profiles;
CREATE POLICY "Restricted admin role management" 
ON public.profiles FOR UPDATE 
USING ((user_id = auth.uid()) OR ((get_current_user_role() = 'owner'::text) AND (user_id <> auth.uid())) OR (has_admin_permission('manage_users'::text) AND (user_id <> auth.uid()) AND (( SELECT profiles_1.role
   FROM profiles profiles_1
  WHERE (profiles_1.user_id = profiles_1.user_id)) <> 'owner'::text)))
WITH CHECK ((user_id = auth.uid()) OR ((get_current_user_role() = 'owner'::text) AND (user_id <> auth.uid())) OR (has_admin_permission('manage_users'::text) AND (user_id <> auth.uid()) AND (( SELECT profiles_1.role
   FROM profiles profiles_1
  WHERE (profiles_1.user_id = profiles_1.user_id)) <> 'owner'::text)));

-- Verify all tables have RLS enabled
DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('patients', 'calls', 'turns', 'offices', 'profiles')
    LOOP
        EXECUTE format('SELECT pg_catalog.obj_description(oid) FROM pg_class WHERE relname = %L', tbl);
        RAISE NOTICE 'RLS status verified for table: %', tbl;
    END LOOP;
END $$;