-- Step 2: Tenant Isolation & Owner Signup
-- Create invites table for managing clinic onboarding

CREATE TABLE public.invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  clinic_name TEXT NOT NULL,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  invite_code TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'base64')
);

-- Enable RLS
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- Create policies for invites
CREATE POLICY "Platform superadmins can manage all invites" 
ON public.invites 
FOR ALL 
USING (is_platform_superadmin());

CREATE POLICY "Users can view their own invites" 
ON public.invites 
FOR SELECT 
USING (email = auth.email());

-- Function to create clinic for new owner
CREATE OR REPLACE FUNCTION public.create_clinic_for_new_user(
  p_clinic_name TEXT,
  p_invite_code TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  new_clinic_id UUID;
  invite_record RECORD;
  user_email TEXT;
BEGIN
  -- Get current user email
  SELECT auth.email() INTO user_email;
  
  IF user_email IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;
  
  -- If invite code provided, validate it
  IF p_invite_code IS NOT NULL THEN
    SELECT * INTO invite_record
    FROM public.invites
    WHERE invite_code = p_invite_code
      AND email = user_email
      AND expires_at > now()
      AND accepted_at IS NULL;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid or expired invite code';
    END IF;
    
    -- Mark invite as accepted
    UPDATE public.invites
    SET accepted_at = now()
    WHERE id = invite_record.id;
  END IF;
  
  -- Create new clinic
  INSERT INTO public.clinics (name, created_by)
  VALUES (p_clinic_name, auth.uid())
  RETURNING id INTO new_clinic_id;
  
  -- Create owner profile
  INSERT INTO public.profiles (user_id, clinic_id, role, display_name)
  VALUES (auth.uid(), new_clinic_id, 'owner', user_email)
  ON CONFLICT (user_id) DO UPDATE SET
    clinic_id = new_clinic_id,
    role = 'owner',
    updated_at = now();
  
  RETURN new_clinic_id;
END;
$$;

-- Function to accept invite and setup clinic
CREATE OR REPLACE FUNCTION public.accept_invite(p_invite_code TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  invite_record RECORD;
  clinic_id UUID;
  result jsonb;
BEGIN
  -- Validate invite
  SELECT * INTO invite_record
  FROM public.invites
  WHERE invite_code = p_invite_code
    AND email = auth.email()
    AND expires_at > now()
    AND accepted_at IS NULL;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid or expired invite code'
    );
  END IF;
  
  -- Create clinic
  SELECT create_clinic_for_new_user(invite_record.clinic_name, p_invite_code) INTO clinic_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'clinic_id', clinic_id,
    'clinic_name', invite_record.clinic_name
  );
END;
$$;