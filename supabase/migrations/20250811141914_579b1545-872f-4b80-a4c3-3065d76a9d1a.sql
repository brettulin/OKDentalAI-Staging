-- Fix the profiles role constraint to allow 'owner'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role = ANY (ARRAY['admin'::text, 'staff'::text, 'owner'::text]));

-- Clean up the temporary policy now that we've identified and fixed the real issue
DROP POLICY IF EXISTS "TEMP allow insert from anyone" ON public.clinics;