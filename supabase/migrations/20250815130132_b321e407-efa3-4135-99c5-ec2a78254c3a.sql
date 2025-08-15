-- Fix greeting audio URL for clinic that's having issues
UPDATE public.ai_settings 
SET greeting_audio_url = 'https://zvpezltqpphvolzgfhme.supabase.co/storage/v1/object/public/audio/audio/greetings/d6e5800e-95d8-4cf0-aa4f-2905926e578e.mp3',
    updated_at = now()
WHERE clinic_id = '550e8400-e29b-41d4-a716-446655440020';