-- Update office to include Twilio phone number for webhook testing
UPDATE offices 
SET pms_credentials = jsonb_set(
  COALESCE(pms_credentials, '{}'),
  '{twilio_phone}',
  '"+18885551234"'
)
WHERE id = '550e8400-e29b-41d4-a716-446655440001';