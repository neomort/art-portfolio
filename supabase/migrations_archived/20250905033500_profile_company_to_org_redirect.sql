-- Redirect updates of profiles.company_name to organizations.name via primary_organization_id
-- Idempotent and safe: if primary_organization_id is null, do nothing.

begin;

create or replace function public.trg_profiles_company_name_to_organizations()
returns trigger language plpgsql as $$
begin
  -- Only act when the company_name actually changes
  if tg_op = 'UPDATE' and NEW.company_name is distinct from OLD.company_name then
    if NEW.primary_organization_id is not null and length(btrim(coalesce(NEW.company_name, ''))) > 0 then
      -- Update the organization's name to the new value
      update public.organizations o
      set name = NEW.company_name
      where o.id = NEW.primary_organization_id
        and o.name is distinct from NEW.company_name;

      -- Prevent direct mutation of profiles.company_name; the org->profiles trigger will propagate
      NEW.company_name := OLD.company_name;
    end if;
  end if;
  return NEW;
end $$;

-- Create trigger if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_profiles_company_name_to_orgs_bu'
  ) THEN
    CREATE TRIGGER trg_profiles_company_name_to_orgs_bu
    BEFORE UPDATE OF company_name ON public.profiles
    FOR EACH ROW EXECUTE PROCEDURE public.trg_profiles_company_name_to_organizations();
  END IF;
END $$;

commit;
