-- Unify on properties: backfill Space Sphere org and replace listings with a compatibility view
BEGIN;

-- 1) Backfill Space Sphere properties.organization_id by venue membership
-- Space Sphere org id: 042f668b-d404-47f9-9c4b-3d517829ca36
UPDATE public.properties p
SET organization_id = '042f668b-d404-47f9-9c4b-3d517829ca36'
WHERE p.organization_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = '042f668b-d404-47f9-9c4b-3d517829ca36'
      AND om.user_id = p.venue_id
  );

-- 2) If a physical listings table exists, rename it to a backup name (idempotent-ish)
DO $$
DECLARE
  exists_table boolean;
  new_name text := 'listings_legacy_backup_20250906';
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'listings' AND c.relkind = 'r'
  ) INTO exists_table;

  IF exists_table THEN
    -- If a previous backup with same name exists, drop it to proceed
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = new_name AND c.relkind = 'r'
    ) THEN
      EXECUTE 'DROP TABLE public.' || quote_ident(new_name) || ' CASCADE';
    END IF;

    EXECUTE 'ALTER TABLE public.listings RENAME TO ' || quote_ident(new_name);
  END IF;
END $$;

-- 3) Create compatibility view over properties
CREATE OR REPLACE VIEW public.listings AS
SELECT
  p.id,
  p.title,
  p.description,
  p.images,
  p.address_street,
  p.address_city,
  p.address_state,
  p.address_postal_code,
  p.address_country,
  p.latitude,
  p.longitude,
  p.price_per_day,
  p.fee_type,
  p.fee_value,
  p.fee_description,
  p.tax_rate,
  p.venue_id,
  p.organization_id,
  p.created_at,
  p.updated_at,
  p.published
FROM public.properties p;

COMMIT;
