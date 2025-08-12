-- Add external_id fields for PMS integration mapping
ALTER TABLE public.patients 
ADD COLUMN IF NOT EXISTS external_id text,
ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';

ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS external_id text;

-- Add indexes for better performance on external_id lookups
CREATE INDEX IF NOT EXISTS idx_patients_external_id ON public.patients(external_id);
CREATE INDEX IF NOT EXISTS idx_appointments_external_id ON public.appointments(external_id);

-- Add office_id reference to track multi-location PMS syncing
ALTER TABLE public.patients 
ADD COLUMN IF NOT EXISTS office_id uuid REFERENCES public.offices(id);

ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS office_id uuid REFERENCES public.offices(id);