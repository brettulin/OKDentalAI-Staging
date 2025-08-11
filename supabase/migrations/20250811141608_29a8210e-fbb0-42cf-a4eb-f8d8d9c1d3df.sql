-- 0) First, let's recreate RLS policies on public.clinics
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;

-- Clean slate for clinics policies
DROP POLICY IF EXISTS "auth can insert clinics" ON public.clinics;
DROP POLICY IF EXISTS "auth can select clinics" ON public.clinics;
DROP POLICY IF EXISTS "users can read their clinics" ON public.clinics;
DROP POLICY IF EXISTS "users can update their clinics" ON public.clinics;
DROP POLICY IF EXISTS "users can delete their clinics" ON public.clinics;

-- Read for logged-in users
CREATE POLICY "auth can select clinics"
ON public.clinics
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Insert for logged-in users
CREATE POLICY "auth can insert clinics"
ON public.clinics
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- 1) Ensure profiles allows the trigger UPSERT
CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_id_key
  ON public.profiles(user_id);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users can select self profile" ON public.profiles;
DROP POLICY IF EXISTS "users can insert self profile" ON public.profiles;
DROP POLICY IF EXISTS "users can update self profile" ON public.profiles;
DROP POLICY IF EXISTS "users can read self profile" ON public.profiles;

CREATE POLICY "users can select self profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "users can insert self profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "users can update self profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 2) Harden the trigger function and reattach
CREATE OR REPLACE FUNCTION public.link_creator_to_clinic()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- debug
  RAISE NOTICE 'link_creator_to_clinic uid=%, clinic_id=%', auth.uid(), NEW.id;

  INSERT INTO public.profiles (user_id, clinic_id, display_name, role)
  VALUES (auth.uid(), NEW.id, null, 'owner')
  ON CONFLICT (user_id) DO UPDATE
    SET clinic_id = EXCLUDED.clinic_id,
        role = EXCLUDED.role;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_creator_to_clinic ON public.clinics;
CREATE TRIGGER trg_link_creator_to_clinic
AFTER INSERT ON public.clinics
FOR EACH ROW EXECUTE PROCEDURE public.link_creator_to_clinic();

-- 3) Phase A test - temporarily add super-permissive policy for testing
CREATE POLICY "TEMP allow insert from anyone"
ON public.clinics
FOR INSERT
TO public
WITH CHECK (true);