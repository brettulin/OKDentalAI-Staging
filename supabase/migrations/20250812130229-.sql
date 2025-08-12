-- Add external_id fields for PMS integration mapping
ALTER TABLE public.patients 
ADD COLUMN external_id text,
ADD COLUMN source text DEFAULT 'manual';

ALTER TABLE public.appointments 
ADD COLUMN external_id text,
ADD COLUMN source text DEFAULT 'manual';

-- Add indexes for better performance on external_id lookups
CREATE INDEX idx_patients_external_id ON public.patients(external_id);
CREATE INDEX idx_appointments_external_id ON public.appointments(external_id);

-- Add office_id reference to track multi-location PMS syncing
ALTER TABLE public.patients 
ADD COLUMN office_id uuid REFERENCES public.offices(id);

ALTER TABLE public.appointments 
ADD COLUMN office_id uuid REFERENCES public.offices(id);