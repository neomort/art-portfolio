-- Add applied_adjustment_ids to properties to persist org-level discount/surcharge selections
-- Safe, idempotent migration

DO $$ BEGIN
  ALTER TABLE public.properties
    ADD COLUMN IF NOT EXISTS applied_adjustment_ids uuid[] DEFAULT '{}'::uuid[];
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Table public.properties does not exist yet; skipping column addition.';
END $$;

-- Optional: index for querying properties by a specific adjustment id
-- This uses GIN on uuid[] for efficient @> and && operators
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS properties_applied_adjustment_ids_gin
    ON public.properties USING GIN (applied_adjustment_ids);
EXCEPTION WHEN undefined_table THEN
  -- Table missing; index will be created by later migration when table exists.
  NULL;
END $$;
