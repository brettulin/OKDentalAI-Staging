-- Update the offices table constraint to allow 'dummy' type
ALTER TABLE public.offices DROP CONSTRAINT IF EXISTS offices_pms_type_check;

-- Recreate the constraint with 'dummy' included
ALTER TABLE public.offices ADD CONSTRAINT offices_pms_type_check 
CHECK (pms_type IN ('carestack', 'dentrix', 'eaglesoft', 'dummy'));