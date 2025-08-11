-- Clean up any duplicate offices that might exist
WITH duplicates AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY clinic_id, name ORDER BY created_at) as rn
  FROM public.offices
)
DELETE FROM public.offices 
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);