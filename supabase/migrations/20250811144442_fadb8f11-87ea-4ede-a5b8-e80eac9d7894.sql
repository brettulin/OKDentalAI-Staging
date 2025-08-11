-- Fix 1: Add unique constraint for offices (clinic_id, name)
CREATE UNIQUE INDEX IF NOT EXISTS offices_unique ON public.offices (clinic_id, name);

-- Fix 2: Update calls outcome constraint to include allowed values
ALTER TABLE public.calls DROP CONSTRAINT IF EXISTS calls_outcome_check;
ALTER TABLE public.calls ADD CONSTRAINT calls_outcome_check 
CHECK (outcome = ANY (ARRAY['appointment_booked'::text, 'transferred'::text, 'voicemail'::text, 'no_answer'::text, 'cancelled'::text, 'completed'::text, 'failed'::text]));

-- Create constants for allowed outcomes
CREATE OR REPLACE FUNCTION public.get_allowed_call_outcomes()
RETURNS text[] AS $$
BEGIN
  RETURN ARRAY['appointment_booked', 'transferred', 'voicemail', 'no_answer', 'cancelled', 'completed', 'failed'];
END;
$$ LANGUAGE plpgsql IMMUTABLE;