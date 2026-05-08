-- Replace BEFORE trigger with AFTER trigger to avoid tuple-modified error
-- and remove NEW mutation since AFTER triggers cannot modify NEW.

begin;

-- Drop previous trigger if exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_profiles_company_name_to_orgs_bu'
  ) THEN
    DROP TRIGGER trg_profiles_company_name_to_orgs_bu ON public.profiles;
  END IF;
END $$;

-- Replace function to be idempotent and suitable for AFTER UPDATE
create or replace function public.trg_profiles_company_name_to_organizations()
returns trigger language plpgsql as $$
begin
  -- Only act when the company_name actually changes and we know the primary org
  if tg_op = 'UPDATE' and NEW.company_name is distinct from OLD.company_name then
    if NEW.primary_organization_id is not null and length(btrim(coalesce(NEW.company_name, ''))) > 0 then
      -- Update the organization's name to the new value
      update public.organizations o
      set name = NEW.company_name
      where o.id = NEW.primary_organization_id
        and o.name is distinct from NEW.company_name;
      -- Do not attempt to modify NEW here; AFTER trigger cannot alter row
    end if;
  end if;
  return NEW;
end $$;

-- Create AFTER UPDATE trigger if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_profiles_company_name_to_orgs_au'
  ) THEN
    CREATE TRIGGER trg_profiles_company_name_to_orgs_au
    AFTER UPDATE OF company_name ON public.profiles
    FOR EACH ROW EXECUTE PROCEDURE public.trg_profiles_company_name_to_organizations();
  END IF;
END $$;

commit;
