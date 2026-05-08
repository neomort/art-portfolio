-- Ensure organization exists/linked when profiles.company_name is edited
-- 1) BEFORE UPDATE trigger: if primary_organization_id is null, find-or-create org and set NEW.primary_organization_id
-- 2) AFTER INSERT trigger on organization_members: set profiles.primary_organization_id if null

begin;

-- Helper: normalize slug similar to existing organizations slug logic
create or replace function public._normalize_slug(s text)
returns text language sql immutable as $$
  select regexp_replace(lower(trim(coalesce(s,''))), '[^a-z0-9]+', '-', 'g')
$$;

-- BEFORE UPDATE trigger function
create or replace function public.trg_profiles_company_name_ensure_org()
returns trigger language plpgsql as $$
declare
  v_name text;
  v_slug text;
  v_org_id uuid;
  v_member_exists boolean;
begin
  if tg_op = 'UPDATE' and NEW.company_name is distinct from OLD.company_name then
    v_name := nullif(btrim(coalesce(NEW.company_name, '')), '');
    if v_name is not null and NEW.primary_organization_id is null then
      v_slug := public._normalize_slug(v_name);
      -- Try to find by slug first, then by case-insensitive name
      select id into v_org_id from public.organizations where slug = v_slug limit 1;
      if v_org_id is null then
        select id into v_org_id from public.organizations where lower(name) = lower(v_name) limit 1;
      end if;
      if v_org_id is null then
        insert into public.organizations(name) values (v_name) returning id into v_org_id;
      end if;
      -- Ensure membership exists
      select exists(
        select 1 from public.organization_members om where om.organization_id = v_org_id and om.user_id = NEW.id
      ) into v_member_exists;
      if not v_member_exists then
        insert into public.organization_members(organization_id, user_id, role)
        values (v_org_id, NEW.id, 'member');
      end if;
      -- Set primary_organization_id on NEW row
      NEW.primary_organization_id := v_org_id;
    end if;
  end if;
  return NEW;
end $$;

-- Create BEFORE UPDATE trigger if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_profiles_company_name_ensure_org_bu'
  ) THEN
    CREATE TRIGGER trg_profiles_company_name_ensure_org_bu
    BEFORE UPDATE OF company_name ON public.profiles
    FOR EACH ROW EXECUTE PROCEDURE public.trg_profiles_company_name_ensure_org();
  END IF;
END $$;

-- AFTER INSERT on organization_members to set primary_organization_id if null
create or replace function public.trg_organization_members_set_primary()
returns trigger language plpgsql as $$
begin
  update public.profiles p
  set primary_organization_id = NEW.organization_id
  where p.id = NEW.user_id
    and p.primary_organization_id is null;
  return NEW;
end $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_organization_members_set_primary_ai'
  ) THEN
    CREATE TRIGGER trg_organization_members_set_primary_ai
    AFTER INSERT ON public.organization_members
    FOR EACH ROW EXECUTE PROCEDURE public.trg_organization_members_set_primary();
  END IF;
END $$;

commit;
