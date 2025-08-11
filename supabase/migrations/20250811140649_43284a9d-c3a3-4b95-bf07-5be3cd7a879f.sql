-- Fix RLS policies for clinics table to allow proper clinic creation flow

-- Drop existing conflicting policies
DROP POLICY IF EXISTS "Users can create clinics" ON public.clinics;
DROP POLICY IF EXISTS "Users can view their clinic" ON public.clinics;
DROP POLICY IF EXISTS "Users can update their clinic" ON public.clinics;
DROP POLICY IF EXISTS "Users can delete their clinic" ON public.clinics;

-- 1) Allow any authenticated user to INSERT a clinic
CREATE POLICY "auth can insert clinics"
ON public.clinics
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 2) Allow users to SELECT clinics they belong to via profiles
CREATE POLICY "users can read their clinics"
ON public.clinics
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.clinic_id = clinics.id
      AND p.user_id = auth.uid()
  )
);

-- 3) Allow UPDATE only if user belongs to clinic
CREATE POLICY "users can update their clinics"
ON public.clinics
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.clinic_id = clinics.id
      AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.clinic_id = clinics.id
      AND p.user_id = auth.uid()
  )
);

-- 4) Allow DELETE only if user belongs to clinic
CREATE POLICY "users can delete their clinics"
ON public.clinics
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.clinic_id = clinics.id
      AND p.user_id = auth.uid()
  )
);

-- Fix profiles policies to be more explicit
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "users can insert self profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "users can read self profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "users can update self profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Function to automatically link creator to clinic
CREATE OR REPLACE FUNCTION public.link_creator_to_clinic()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create or update profile for the creator
  INSERT INTO public.profiles (user_id, clinic_id, display_name, role)
  VALUES (auth.uid(), NEW.id, null, 'owner')
  ON CONFLICT (user_id) DO UPDATE
    SET clinic_id = EXCLUDED.clinic_id,
        role = EXCLUDED.role;
  RETURN NEW;
END;
$$;

-- Trigger to automatically link clinic creator
DROP TRIGGER IF EXISTS trg_link_creator_to_clinic ON public.clinics;

CREATE TRIGGER trg_link_creator_to_clinic
AFTER INSERT ON public.clinics
FOR EACH ROW
EXECUTE FUNCTION public.link_creator_to_clinic();