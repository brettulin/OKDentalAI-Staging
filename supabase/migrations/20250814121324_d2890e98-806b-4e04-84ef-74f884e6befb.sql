-- Insert test clinic data without triggering profile creation
INSERT INTO public.clinics (id, name, main_phone, created_at)
VALUES ('550e8400-e29b-41d4-a716-446655440020', 'Test Clinic - Twilio', '+14058352486', now())
ON CONFLICT (main_phone) DO UPDATE SET 
  name = EXCLUDED.name,
  updated_at = now();

-- Insert office data  
INSERT INTO public.offices (id, clinic_id, name, pms_type, created_at, updated_at)
VALUES ('550e8400-e29b-41d4-a716-446655440021', '550e8400-e29b-41d4-a716-446655440020', 'Main Office', 'dummy', now(), now())
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  updated_at = now();

-- Insert AI settings
INSERT INTO public.ai_settings (clinic_id, voice_id, language, transfer_number, created_at, updated_at)
VALUES ('550e8400-e29b-41d4-a716-446655440020', '9BWtsMINqrJLrRacOk9x', 'en', '+14058352486', now(), now())
ON CONFLICT (clinic_id) DO UPDATE SET
  transfer_number = EXCLUDED.transfer_number,
  updated_at = now();

-- Insert location data
INSERT INTO public.locations (clinic_id, name, phone, address, created_at)
VALUES ('550e8400-e29b-41d4-a716-446655440020', 'Main Location', '+14058352486', '123 Main St, Test City, CA 12345', now())
ON CONFLICT (clinic_id, name) DO UPDATE SET
  phone = EXCLUDED.phone,
  address = EXCLUDED.address;

-- Insert provider data  
INSERT INTO public.providers (clinic_id, name, specialty, created_at)
VALUES ('550e8400-e29b-41d4-a716-446655440020', 'Dr. Test Provider', 'General Dentistry', now())
ON CONFLICT (clinic_id, name) DO UPDATE SET
  specialty = EXCLUDED.specialty;

-- Insert service data
INSERT INTO public.services (clinic_id, name, duration_min, code, created_at)
VALUES ('550e8400-e29b-41d4-a716-446655440020', 'Consultation', 30, 'CONSULT', now())
ON CONFLICT (clinic_id, name) DO UPDATE SET
  duration_min = EXCLUDED.duration_min,
  code = EXCLUDED.code;