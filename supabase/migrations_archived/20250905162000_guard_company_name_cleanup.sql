-- Guard migration to ensure legacy company_name references are removed and org fields are present
BEGIN;

-- 1) Ensure profiles.company_name is dropped (idempotent)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS company_name;

-- 2) Drop known triggers that referenced profiles.company_name (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_profiles_company_name_to_orgs_bu') THEN
    DROP TRIGGER trg_profiles_company_name_to_orgs_bu ON public.profiles;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_profiles_company_name_to_orgs_au') THEN
    DROP TRIGGER trg_profiles_company_name_to_orgs_au ON public.profiles;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_profiles_company_name_ensure_org_bu') THEN
    DROP TRIGGER trg_profiles_company_name_ensure_org_bu ON public.profiles;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_organizations_name_to_profiles_aiu') THEN
    DROP TRIGGER trg_organizations_name_to_profiles_aiu ON public.organizations;
  END IF;
END $$;

-- 3) Drop their functions if present (idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'trg_profiles_company_name_to_organizations' AND n.nspname = 'public'
  ) THEN
    DROP FUNCTION public.trg_profiles_company_name_to_organizations();
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'trg_profiles_company_name_ensure_org' AND n.nspname = 'public'
  ) THEN
    DROP FUNCTION public.trg_profiles_company_name_ensure_org();
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'trg_organizations_name_to_profiles' AND n.nspname = 'public'
  ) THEN
    DROP FUNCTION public.trg_organizations_name_to_profiles();
  END IF;
END $$;

-- 4) Ensure profiles.primary_organization_id exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS primary_organization_id uuid;

-- 5) Ensure FK to organizations(id) exists
DO $$
DECLARE
  exists_fk boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'profiles' AND c.conname = 'profiles_primary_organization_id_fkey'
  ) INTO exists_fk;
  IF NOT exists_fk THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_primary_organization_id_fkey
      FOREIGN KEY (primary_organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

-- 6) Helpful indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_profiles_primary_organization_id ON public.profiles (primary_organization_id);

COMMIT;
