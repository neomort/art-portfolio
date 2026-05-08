-- Drop compatibility view and legacy listings table backup (if present)
BEGIN;

-- Drop view public.listings if exists
DROP VIEW IF EXISTS public.listings;

-- Drop legacy backup table if it exists (created during unification)
DO $$
DECLARE
  backup_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'listings_legacy_backup_20250906' AND c.relkind = 'r'
  ) INTO backup_exists;

  IF backup_exists THEN
    EXECUTE 'DROP TABLE public.listings_legacy_backup_20250906 CASCADE';
  END IF;
END $$;

COMMIT;
