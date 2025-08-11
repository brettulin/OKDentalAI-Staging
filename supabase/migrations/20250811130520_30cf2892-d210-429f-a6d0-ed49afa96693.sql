-- Create dental AI schema with all required tables

-- Clinics table
CREATE TABLE public.clinics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  main_phone TEXT,
  timezone TEXT DEFAULT 'America/New_York',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Locations table
CREATE TABLE public.locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  timezone TEXT DEFAULT 'America/New_York',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Providers table
CREATE TABLE public.providers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  specialty TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Services table
CREATE TABLE public.services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  code TEXT,
  name TEXT NOT NULL,
  duration_min INTEGER NOT NULL DEFAULT 60,
  is_new_patient BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insurances table
CREATE TABLE public.insurances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  accepted BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Clinic hours table
CREATE TABLE public.clinic_hours (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  dow INTEGER NOT NULL CHECK (dow >= 0 AND dow <= 6), -- 0 = Sunday, 6 = Saturday
  open_min INTEGER NOT NULL CHECK (open_min >= 0 AND open_min < 1440), -- minutes from midnight
  close_min INTEGER NOT NULL CHECK (close_min >= 0 AND close_min < 1440),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(clinic_id, dow)
);

-- Slots table  
CREATE TABLE public.slots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES public.providers(id) ON DELETE CASCADE,
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'held', 'booked')),
  held_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Patients table
CREATE TABLE public.patients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  dob DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Calls table
CREATE TABLE public.calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  twilio_call_sid TEXT UNIQUE,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  outcome TEXT CHECK (outcome IN ('booked', 'voicemail', 'transfer', 'abandoned')),
  transcript_json JSONB
);

-- Turns table (conversation turns)
CREATE TABLE public.turns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id UUID NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  text TEXT NOT NULL,
  at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  meta JSONB -- for tokens, llm_model, etc.
);

-- Appointments table
CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES public.providers(id) ON DELETE SET NULL,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
  source TEXT DEFAULT 'manual' CHECK (source IN ('voice_ai', 'manual')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Audit log table
CREATE TABLE public.audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  actor TEXT NOT NULL, -- system/user
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID,
  diff_json JSONB,
  at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security on all tables
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Create profiles table for user management
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
  display_name TEXT,
  role TEXT DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tenant isolation by clinic_id

-- Clinics: users can only see clinics they belong to
CREATE POLICY "Users can view their clinic" ON public.clinics
  FOR SELECT USING (
    id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE user_id = auth.uid()
    )
  );

-- Generic clinic-based RLS policy for all clinic-scoped tables
CREATE POLICY "Clinic isolation policy" ON public.locations
  FOR ALL USING (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Clinic isolation policy" ON public.providers
  FOR ALL USING (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Clinic isolation policy" ON public.services
  FOR ALL USING (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Clinic isolation policy" ON public.insurances
  FOR ALL USING (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Clinic isolation policy" ON public.clinic_hours
  FOR ALL USING (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Clinic isolation policy" ON public.slots
  FOR ALL USING (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Clinic isolation policy" ON public.patients
  FOR ALL USING (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Clinic isolation policy" ON public.calls
  FOR ALL USING (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Clinic isolation policy" ON public.turns
  FOR ALL USING (
    call_id IN (
      SELECT id FROM public.calls 
      WHERE clinic_id IN (
        SELECT clinic_id FROM public.profiles 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Clinic isolation policy" ON public.appointments
  FOR ALL USING (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Clinic isolation policy" ON public.audit_log
  FOR ALL USING (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE user_id = auth.uid()
    )
  );

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (user_id = auth.uid());

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for profiles updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to automatically clear expired held slots
CREATE OR REPLACE FUNCTION public.clear_expired_holds()
RETURNS void AS $$
BEGIN
  UPDATE public.slots 
  SET status = 'open', held_until = NULL
  WHERE status = 'held' 
    AND held_until IS NOT NULL 
    AND held_until < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for performance
CREATE INDEX idx_locations_clinic_id ON public.locations(clinic_id);
CREATE INDEX idx_providers_clinic_id ON public.providers(clinic_id);
CREATE INDEX idx_services_clinic_id ON public.services(clinic_id);
CREATE INDEX idx_insurances_clinic_id ON public.insurances(clinic_id);
CREATE INDEX idx_clinic_hours_clinic_id ON public.clinic_hours(clinic_id);
CREATE INDEX idx_slots_clinic_id ON public.slots(clinic_id);
CREATE INDEX idx_slots_status ON public.slots(status);
CREATE INDEX idx_slots_starts_at ON public.slots(starts_at);
CREATE INDEX idx_patients_clinic_id ON public.patients(clinic_id);
CREATE INDEX idx_calls_clinic_id ON public.calls(clinic_id);
CREATE INDEX idx_turns_call_id ON public.turns(call_id);
CREATE INDEX idx_appointments_clinic_id ON public.appointments(clinic_id);
CREATE INDEX idx_appointments_starts_at ON public.appointments(starts_at);
CREATE INDEX idx_audit_log_clinic_id ON public.audit_log(clinic_id);
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profiles_clinic_id ON public.profiles(clinic_id);