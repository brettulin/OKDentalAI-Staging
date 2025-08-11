-- 1) Make sure profiles.user_id is unique (so ON CONFLICT (user_id) works)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_id_key
  ON public.profiles(user_id);

-- 2) RLS policies for profiles (add UPDATE)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Keep existing INSERT/SELECT policies, but add/replace UPDATE:
DROP POLICY IF EXISTS "users can update self profile" ON public.profiles;

CREATE POLICY "users can update self profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 3) Harden the trigger function (schema qualified, security definer)
CREATE OR REPLACE FUNCTION public.link_creator_to_clinic()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Add debugging notice
  RAISE NOTICE 'link_creator_to_clinic uid=%, new.clinic_id=%', auth.uid(), NEW.id;
  
  INSERT INTO public.profiles (user_id, clinic_id, display_name, role)
  VALUES (auth.uid(), NEW.id, null, 'owner')
  ON CONFLICT (user_id) DO UPDATE
    SET clinic_id = EXCLUDED.clinic_id,
        role = EXCLUDED.role;
  RETURN NEW;
END;
$$;

-- Re-create trigger to use the updated function (idempotent)
DROP TRIGGER IF EXISTS trg_link_creator_to_clinic ON public.clinics;
CREATE TRIGGER trg_link_creator_to_clinic
AFTER INSERT ON public.clinics
FOR EACH ROW EXECUTE PROCEDURE public.link_creator_to_clinic();