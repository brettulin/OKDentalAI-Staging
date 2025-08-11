-- First update the offices table to allow 'dummy' as a PMS type
ALTER TABLE public.offices DROP CONSTRAINT IF EXISTS offices_pms_type_check;
ALTER TABLE public.offices ADD CONSTRAINT offices_pms_type_check 
CHECK (pms_type IN ('carestack', 'dentrix', 'eaglesoft', 'dummy'));

-- Create a test clinic
INSERT INTO public.clinics (id, name, main_phone, timezone, created_at) VALUES 
('550e8400-e29b-41d4-a716-446655440000', 'Bright Smiles Dental', '(405) 555-2381', 'America/Chicago', now());

-- Create a test office with dummy PMS type
INSERT INTO public.offices (id, clinic_id, name, pms_type, pms_credentials, created_at, updated_at) VALUES 
('550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', 'Main Office', 'dummy', '{}', now(), now());

-- Create test location
INSERT INTO public.locations (id, clinic_id, name, address, phone, timezone, created_at) VALUES 
('550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440000', 'Main Office', '123 Main St, Norman, OK 73069', '(405) 555-2381', 'America/Chicago', now());

-- Create test providers
INSERT INTO public.providers (id, clinic_id, name, specialty, created_at) VALUES 
('550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440000', 'Dr. Emily Hughes', 'General Dentistry', now()),
('550e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440000', 'Dr. Michael Chen', 'Orthodontics', now());

-- Create test services
INSERT INTO public.services (id, clinic_id, name, duration_min, code, is_new_patient, created_at) VALUES 
('550e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440000', 'Cleaning & Exam', 60, 'D1110', false, now()),
('550e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440000', 'New Patient Exam', 90, 'D0150', true, now()),
('550e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440000', 'Filling', 45, 'D2140', false, now());

-- Create clinic hours (Monday-Friday 8am-5pm)
INSERT INTO public.clinic_hours (id, clinic_id, dow, open_min, close_min, created_at) VALUES 
('550e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440000', 1, 480, 1020, now()),
('550e8400-e29b-41d4-a716-446655440009', '550e8400-e29b-41d4-a716-446655440000', 2, 480, 1020, now()),
('550e8400-e29b-41d4-a716-44665544000a', '550e8400-e29b-41d4-a716-446655440000', 3, 480, 1020, now()),
('550e8400-e29b-41d4-a716-44665544000b', '550e8400-e29b-41d4-a716-446655440000', 4, 480, 1020, now()),
('550e8400-e29b-41d4-a716-44665544000c', '550e8400-e29b-41d4-a716-446655440000', 5, 480, 1020, now());

-- Create test patients
INSERT INTO public.patients (id, clinic_id, full_name, phone, email, dob, created_at) VALUES 
('550e8400-e29b-41d4-a716-44665544000d', '550e8400-e29b-41d4-a716-446655440000', 'John Doe', '(405) 555-0198', 'john.doe@example.com', '1988-05-21', now()),
('550e8400-e29b-41d4-a716-44665544000e', '550e8400-e29b-41d4-a716-446655440000', 'Sarah Miller', '(405) 555-0112', 'sarah.miller@example.com', '1992-11-08', now()),
('550e8400-e29b-41d4-a716-44665544000f', '550e8400-e29b-41d4-a716-446655440000', 'Robert Johnson', '(405) 555-0187', 'robert.johnson@example.com', '1985-03-15', now());

-- Create some existing appointments
INSERT INTO public.appointments (id, clinic_id, patient_id, provider_id, location_id, service_id, starts_at, ends_at, source, created_at) VALUES 
('550e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-44665544000d', '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440005', '2025-08-12T09:00:00-05:00', '2025-08-12T10:00:00-05:00', 'phone', now());

-- Create available slots for testing (next few days)
INSERT INTO public.slots (id, clinic_id, provider_id, location_id, starts_at, ends_at, status, created_at) VALUES 
('550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002', '2025-08-13T10:00:00-05:00', '2025-08-13T11:00:00-05:00', 'open', now()),
('550e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002', '2025-08-13T14:00:00-05:00', '2025-08-13T15:00:00-05:00', 'open', now()),
('550e8400-e29b-41d4-a716-446655440013', '550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440002', '2025-08-14T09:00:00-05:00', '2025-08-14T10:30:00-05:00', 'open', now()),
('550e8400-e29b-41d4-a716-446655440014', '550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002', '2025-08-14T15:00:00-05:00', '2025-08-14T16:00:00-05:00', 'open', now());