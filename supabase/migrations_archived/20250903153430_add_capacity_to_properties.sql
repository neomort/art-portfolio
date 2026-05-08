-- Add capacity column to properties
-- Nullable, non-negative by usage; front-end enforces min=0
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS capacity integer;

-- Optional: add a check constraint (commented out to avoid deploy risk if existing data violates it)
-- DO $$
-- BEGIN
--   IF NOT EXISTS (
--     SELECT 1 FROM pg_constraint
--     WHERE conname = 'properties_capacity_nonnegative'
--   ) THEN
--     ALTER TABLE public.properties
--       ADD CONSTRAINT properties_capacity_nonnegative CHECK (capacity IS NULL OR capacity >= 0);
--   END IF;
-- END $$;
