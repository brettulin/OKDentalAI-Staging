-- Add offices table for PMS configuration
CREATE TABLE public.offices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  pms_type TEXT NOT NULL CHECK (pms_type IN ('carestack', 'dentrix', 'eaglesoft')),
  pms_credentials JSONB,
  clinic_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.offices ENABLE ROW LEVEL SECURITY;

-- Create policy for office access
CREATE POLICY "Clinic isolation policy" 
ON public.offices 
FOR ALL 
USING (clinic_id IN ( 
  SELECT profiles.clinic_id
  FROM profiles
  WHERE (profiles.user_id = auth.uid())
));

-- Add office_id to calls table for tracking
ALTER TABLE public.calls ADD COLUMN office_id UUID REFERENCES public.offices(id);

-- Add trigger for updated_at
CREATE TRIGGER update_offices_updated_at
BEFORE UPDATE ON public.offices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();