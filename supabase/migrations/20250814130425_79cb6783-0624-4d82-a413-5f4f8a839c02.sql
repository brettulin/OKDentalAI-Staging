-- 1. Create phone_numbers table
CREATE TABLE IF NOT EXISTS public.phone_numbers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid NOT NULL,
  e164 text NOT NULL UNIQUE,
  twilio_sid text,
  capabilities jsonb DEFAULT '{"voice": true, "sms": true}'::jsonb,
  status text DEFAULT 'active',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.phone_numbers ENABLE ROW LEVEL SECURITY;

-- Create policy for clinic isolation
CREATE POLICY "Clinic isolation policy" ON public.phone_numbers
  FOR ALL USING (clinic_id IN (
    SELECT profiles.clinic_id FROM public.profiles WHERE profiles.user_id = auth.uid()
  ));

-- Add trigger for updated_at
CREATE TRIGGER update_phone_numbers_updated_at
  BEFORE UPDATE ON public.phone_numbers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert the Twilio number for the main clinic
INSERT INTO public.phone_numbers (clinic_id, e164, twilio_sid, capabilities, status)
VALUES (
  '550e8400-e29b-41d4-a716-446655440020',
  '+14058352486',
  'PN_your_twilio_phone_sid',
  '{"voice": true, "sms": true}'::jsonb,
  'active'
) ON CONFLICT (e164) DO UPDATE SET
  clinic_id = EXCLUDED.clinic_id,
  twilio_sid = EXCLUDED.twilio_sid,
  updated_at = now();

-- 2. Update ai_settings table to include all required fields
ALTER TABLE public.ai_settings 
ADD COLUMN IF NOT EXISTS custom_greeting text,
ADD COLUMN IF NOT EXISTS greeting_audio_url text,
ADD COLUMN IF NOT EXISTS voice_enabled boolean DEFAULT true;

-- Update existing settings with custom greeting
UPDATE public.ai_settings 
SET custom_greeting = COALESCE(booking_policy->>'greeting', 'Hello, my name is Clarice from Family Dental, how may I help you?')
WHERE custom_greeting IS NULL;