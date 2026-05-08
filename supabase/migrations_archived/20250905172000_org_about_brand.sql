-- Add organizations.about_brand and backfill from profiles.about_brand
-- Safe to run multiple times
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'about_brand'
  ) THEN
    ALTER TABLE public.organizations ADD COLUMN about_brand text;
  END IF;
END $$;

-- Backfill from profiles.about_brand when linked via primary_organization_id,
-- but only when the organization doesn't already have a value
UPDATE public.organizations o
SET about_brand = p.about_brand
FROM public.profiles p
WHERE p.primary_organization_id = o.id
  AND p.about_brand IS NOT NULL
  AND (o.about_brand IS NULL OR length(btrim(coalesce(o.about_brand, ''))) = 0);

COMMIT;
