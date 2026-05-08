-- Drop profiles.company_name and related triggers/functions now that organization is the source of truth
begin;

-- Drop triggers that rely on profiles.company_name
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_profiles_company_name_to_orgs_au') THEN
    DROP TRIGGER trg_profiles_company_name_to_orgs_au ON public.profiles;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_profiles_company_name_ensure_org_bu') THEN
    DROP TRIGGER trg_profiles_company_name_ensure_org_bu ON public.profiles;
  END IF;
END $$;

-- Drop function bodies for those triggers if present
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
END $$;

-- Drop org->profiles propagation trigger since profiles.company_name no longer exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_organizations_name_to_profiles_aiu') THEN
    DROP TRIGGER trg_organizations_name_to_profiles_aiu ON public.organizations;
  END IF;
END $$;

-- Drop its function if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'trg_organizations_name_to_profiles' AND n.nspname = 'public'
  ) THEN
    DROP FUNCTION public.trg_organizations_name_to_profiles();
  END IF;
END $$;

-- Finally, drop the column
ALTER TABLE public.profiles DROP COLUMN IF EXISTS company_name;

commit;
