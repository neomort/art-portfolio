-- Drop profile-level service credit now that credit is org-scoped
-- - Removes any triggers referencing service_credit on profiles
-- - Drops the column if present

BEGIN;

-- Drop trigger if it exists (non-fatal if missing)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_profiles_service_credit_nn'
  ) THEN
    DROP TRIGGER trg_profiles_service_credit_nn ON public.profiles;
  END IF;
END $$;

-- Drop column if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'service_credit'
  ) THEN
    ALTER TABLE public.profiles DROP COLUMN service_credit;
  END IF;
END $$;

COMMIT;
