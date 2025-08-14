-- Find and disable the clinic trigger temporarily
DROP TRIGGER IF EXISTS clinic_profile_trigger ON public.clinics;

-- Insert test clinic data with specific IDs
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

-- Recreate the trigger for future use
CREATE TRIGGER clinic_profile_trigger
    AFTER INSERT ON public.clinics
    FOR EACH ROW EXECUTE FUNCTION public.link_creator_to_clinic();