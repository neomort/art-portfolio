-- Drop profiles.about_brand now that about_brand is organization-scoped
BEGIN;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS about_brand;

COMMIT;
