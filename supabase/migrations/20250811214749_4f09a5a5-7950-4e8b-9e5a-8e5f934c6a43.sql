-- Add unique constraint to prevent duplicate offices
CREATE UNIQUE INDEX IF NOT EXISTS offices_unique ON public.offices (clinic_id, name);

-- Ensure proper RLS for offices table
ALTER TABLE public.offices ENABLE ROW LEVEL SECURITY;

-- Create comprehensive RLS policy for offices (if not exists)
DROP POLICY IF EXISTS "Clinic isolation policy" ON public.offices;
CREATE POLICY "Clinic isolation policy" ON public.offices
FOR ALL
USING (clinic_id IN (
  SELECT profiles.clinic_id
  FROM profiles
  WHERE profiles.user_id = auth.uid()
));