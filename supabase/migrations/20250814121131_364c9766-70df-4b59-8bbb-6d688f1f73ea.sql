-- Create clinic and office for brettu2006@gmail.com with Twilio phone number
-- First, let's check if user exists and get their ID
DO $$
DECLARE
    user_uuid uuid;
    clinic_uuid uuid;
    office_uuid uuid;
BEGIN
    -- Get or create user record (this would normally be done through auth, but for testing we'll assume user exists)
    -- For now, we'll create a test clinic and office with a known structure
    
    -- Create clinic
    INSERT INTO public.clinics (id, name, main_phone)
    VALUES (gen_random_uuid(), 'Test Clinic', '+14058352486')
    RETURNING id INTO clinic_uuid;
    
    -- Create office with Twilio phone number
    INSERT INTO public.offices (id, clinic_id, name, pms_type)
    VALUES (gen_random_uuid(), clinic_uuid, 'Main Office', 'dummy')
    RETURNING id INTO office_uuid;
    
    -- Create AI settings for the clinic
    INSERT INTO public.ai_settings (clinic_id, voice_id, language, transfer_number)
    VALUES (clinic_uuid, '9BWtsMINqrJLrRacOk9x', 'en', '+14058352486');
    
    -- Create a test location
    INSERT INTO public.locations (clinic_id, name, phone, address)
    VALUES (clinic_uuid, 'Main Location', '+14058352486', '123 Main St, Test City, CA 12345');
    
    -- Create a test provider
    INSERT INTO public.providers (clinic_id, name, specialty)
    VALUES (clinic_uuid, 'Dr. Test Provider', 'General Dentistry');
    
    -- Create a test service
    INSERT INTO public.services (clinic_id, name, duration_min, code)
    VALUES (clinic_uuid, 'Consultation', 30, 'CONSULT');
    
    RAISE NOTICE 'Created clinic with ID: %', clinic_uuid;
END $$;