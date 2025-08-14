-- 1. Ensure phone_numbers table has proper structure and index
CREATE TABLE IF NOT EXISTS public.phone_numbers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid NOT NULL,
  e164 text NOT NULL UNIQUE,
  twilio_sid text,
  capabilities jsonb DEFAULT '{"voice": true, "sms": true}'::jsonb,
  status text DEFAULT 'active',
  purchased_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Add index on e164 for fast lookups
CREATE INDEX IF NOT EXISTS idx_phone_numbers_e164 ON public.phone_numbers(e164);

-- Ensure proper RLS
ALTER TABLE public.phone_numbers ENABLE ROW LEVEL SECURITY;

-- Update or create clinic phone number
INSERT INTO public.phone_numbers (clinic_id, e164, twilio_sid, status)
VALUES (
  '550e8400-e29b-41d4-a716-446655440020',
  '+14058352486',
  'PN_twilio_phone_sid',
  'active'
) ON CONFLICT (e164) DO UPDATE SET
  clinic_id = EXCLUDED.clinic_id,
  twilio_sid = EXCLUDED.twilio_sid,
  status = EXCLUDED.status,
  updated_at = now();

-- Ensure ai_settings has all required fields
ALTER TABLE public.ai_settings 
ADD COLUMN IF NOT EXISTS custom_greeting text DEFAULT 'Hello, my name is Clarice from Family Dental, how may I help you?',
ADD COLUMN IF NOT EXISTS greeting_audio_url text,
ADD COLUMN IF NOT EXISTS voice_enabled boolean DEFAULT true;

-- Update existing ai_settings with default greeting if null
UPDATE public.ai_settings 
SET custom_greeting = 'Hello, my name is Clarice from Family Dental, how may I help you?'
WHERE custom_greeting IS NULL OR custom_greeting = '';