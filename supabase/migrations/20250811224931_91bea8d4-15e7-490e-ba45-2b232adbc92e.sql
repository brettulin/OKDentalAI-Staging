-- Create ai_settings table for AI configuration
CREATE TABLE public.ai_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL,
  voice_provider TEXT DEFAULT 'elevenlabs',
  voice_model TEXT DEFAULT 'eleven_multilingual_v2',
  language TEXT DEFAULT 'en',
  transfer_number TEXT,
  booking_policy JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for ai_settings
CREATE POLICY "Clinic isolation policy" 
ON public.ai_settings 
FOR ALL 
USING (clinic_id IN ( 
  SELECT profiles.clinic_id
  FROM profiles
  WHERE (profiles.user_id = auth.uid())
));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_ai_settings_updated_at
BEFORE UPDATE ON public.ai_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();