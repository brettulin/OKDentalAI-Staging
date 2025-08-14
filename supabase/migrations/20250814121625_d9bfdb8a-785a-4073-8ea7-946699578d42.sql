-- Temporarily modify the link_creator_to_clinic function to handle null auth.uid()
CREATE OR REPLACE FUNCTION public.link_creator_to_clinic()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip profile creation if no authenticated user (for testing data)
  IF auth.uid() IS NOT NULL THEN
    INSERT INTO public.profiles (user_id, clinic_id, display_name, role)
    VALUES (auth.uid(), NEW.id, null, 'owner')
    ON CONFLICT (user_id) DO UPDATE
      SET clinic_id = EXCLUDED.clinic_id,
          role = EXCLUDED.role;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Now insert test clinic data
INSERT INTO public.clinics (id, name, main_phone, created_at)
VALUES ('550e8400-e29b-41d4-a716-446655440020', 'Test Clinic - Twilio', '+14058352486', now());

-- Insert office data  
INSERT INTO public.offices (id, clinic_id, name, pms_type, created_at, updated_at)
VALUES ('550e8400-e29b-41d4-a716-446655440021', '550e8400-e29b-41d4-a716-446655440020', 'Main Office', 'dummy', now(), now());

-- Insert AI settings
INSERT INTO public.ai_settings (clinic_id, voice_id, language, transfer_number, created_at, updated_at)
VALUES ('550e8400-e29b-41d4-a716-446655440020', '9BWtsMINqrJLrRacOk9x', 'en', '+14058352486', now(), now());

-- Insert location data
INSERT INTO public.locations (clinic_id, name, phone, address, created_at)
VALUES ('550e8400-e29b-41d4-a716-446655440020', 'Main Location', '+14058352486', '123 Main St, Test City, CA 12345', now());

-- Insert provider data  
INSERT INTO public.providers (clinic_id, name, specialty, created_at)
VALUES ('550e8400-e29b-41d4-a716-446655440020', 'Dr. Test Provider', 'General Dentistry', now());

-- Insert service data
INSERT INTO public.services (clinic_id, name, duration_min, code, created_at)
VALUES ('550e8400-e29b-41d4-a716-446655440020', 'Consultation', 30, 'CONSULT', now());