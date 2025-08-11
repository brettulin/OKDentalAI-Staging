-- Fix security warning: Set search_path for the function
CREATE OR REPLACE FUNCTION public.link_creator_to_clinic()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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