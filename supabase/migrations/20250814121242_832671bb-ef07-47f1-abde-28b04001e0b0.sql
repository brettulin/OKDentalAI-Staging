-- Temporarily disable trigger, create test data, then re-enable
ALTER TABLE public.clinics DISABLE TRIGGER on_auth_user_created;

-- Create test clinic and office for Twilio phone number
DO $$
DECLARE
    clinic_uuid uuid := gen_random_uuid();
    office_uuid uuid := gen_random_uuid();
BEGIN
    -- Create clinic directly
    INSERT INTO public.clinics (id, name, main_phone, created_at)
    VALUES (clinic_uuid, 'Test Clinic - Twilio', '+14058352486', now());
    
    -- Create office with Twilio phone number
    INSERT INTO public.offices (id, clinic_id, name, pms_type, created_at, updated_at)
    VALUES (office_uuid, clinic_uuid, 'Main Office', 'dummy', now(), now());
    
    -- Create AI settings for the clinic
    INSERT INTO public.ai_settings (clinic_id, voice_id, language, transfer_number, created_at, updated_at)
    VALUES (clinic_uuid, '9BWtsMINqrJLrRacOk9x', 'en', '+14058352486', now(), now());
    
    -- Create a test location
    INSERT INTO public.locations (clinic_id, name, phone, address, created_at)
    VALUES (clinic_uuid, 'Main Location', '+14058352486', '123 Main St, Test City, CA 12345', now());
    
    -- Create a test provider
    INSERT INTO public.providers (clinic_id, name, specialty, created_at)
    VALUES (clinic_uuid, 'Dr. Test Provider', 'General Dentistry', now());
    
    -- Create a test service
    INSERT INTO public.services (clinic_id, name, duration_min, code, created_at)
    VALUES (clinic_uuid, 'Consultation', 30, 'CONSULT', now());
    
    RAISE NOTICE 'Successfully created test clinic with ID: % for phone: %', clinic_uuid, '+14058352486';
END $$;

-- Re-enable the trigger
ALTER TABLE public.clinics ENABLE TRIGGER on_auth_user_created;