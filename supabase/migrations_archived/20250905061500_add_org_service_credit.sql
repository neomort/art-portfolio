-- Add organizations.service_credit and migrate values from profiles.service_credit
-- Notes:
-- - New column: organizations.service_credit numeric not null default 0
-- - Backfill: sum profile credits per primary_organization_id into organizations
-- - Reset profiles.service_credit to 0 to avoid double-counting going forward

BEGIN;

-- 1) Add column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'organizations'
      AND column_name  = 'service_credit'
  ) THEN
    ALTER TABLE public.organizations
      ADD COLUMN service_credit numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

-- 2) Backfill from profiles.service_credit -> organizations.service_credit (grouped per org)
--    We use SUM to support any historical duplicates; most deployments will have at most one profile per org carrying credit.
WITH credits AS (
  SELECT
    primary_organization_id AS org_id,
    SUM(COALESCE(service_credit, 0)) AS total_credit
  FROM public.profiles
  WHERE primary_organization_id IS NOT NULL
  GROUP BY primary_organization_id
)
UPDATE public.organizations o
SET service_credit = COALESCE(o.service_credit, 0) + COALESCE(c.total_credit, 0)
FROM credits c
WHERE o.id = c.org_id;

-- 3) Zero out profile-level credits to prevent future ambiguity
UPDATE public.profiles
SET service_credit = 0
WHERE COALESCE(service_credit, 0) <> 0;

COMMIT;
