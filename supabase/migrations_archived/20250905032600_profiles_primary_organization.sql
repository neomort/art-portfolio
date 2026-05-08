-- Add primary_organization_id to profiles and migrate company-centric fields to organization-centric
-- Idempotent migration

begin;

-- 1) Add column if not exists
alter table if exists public.profiles
  add column if not exists primary_organization_id uuid references public.organizations(id) on delete set null;

-- 2) Backfill primary_organization_id
-- Prefer existing membership; otherwise match by name/slug
with first_membership as (
  select om.user_id as profile_id, om.organization_id,
         row_number() over (partition by om.user_id order by om.created_at asc nulls last) as rn
  from public.organization_members om
)
update public.profiles p
set primary_organization_id = fm.organization_id
from first_membership fm
where p.id = fm.profile_id
  and fm.rn = 1
  and p.primary_organization_id is null;

-- Fallback by name if still null
update public.profiles p
set primary_organization_id = o.id
from public.organizations o
where p.primary_organization_id is null
  and p.company_name is not null
  and length(btrim(p.company_name)) > 0
  and (
    lower(regexp_replace(coalesce(p.company_name,''),'[^a-z0-9]+','-','g')) = o.slug
    or lower(btrim(p.company_name)) = lower(btrim(o.name))
  );

-- 3) Move any legacy brevo_company_id from profiles to organizations if such a column exists
-- and clear it on profiles. Do this only when org doesn't already have one.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' and table_name = 'profiles' and column_name = 'brevo_company_id'
  ) THEN
    -- Backfill to orgs via membership or primary_organization_id
    update public.organizations o
    set brevo_company_id = p.brevo_company_id
    from public.profiles p
    left join public.organization_members om on om.user_id = p.id
    where o.id = coalesce(p.primary_organization_id, om.organization_id)
      and o.brevo_company_id is null
      and p.brevo_company_id is not null;

    -- Clear on profiles
    update public.profiles p
    set brevo_company_id = null
    where p.brevo_company_id is not null;
  END IF;
END $$;

-- 4) Optional: keep profiles.company_name synced from org for compatibility
-- Create a trigger to propagate org name changes down to profiles.company_name so legacy UI still displays the correct value.
create or replace function public.trg_organizations_name_to_profiles()
returns trigger language plpgsql as $$
begin
  -- Update all member profiles' company_name to new org name
  update public.profiles p
  set company_name = NEW.name
  from public.organization_members om
  where om.organization_id = NEW.id
    and p.id = om.user_id
    and coalesce(p.company_name,'') is distinct from NEW.name;
  return NEW;
end $$;

-- Create the trigger if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_organizations_name_to_profiles_aiu'
  ) THEN
    CREATE TRIGGER trg_organizations_name_to_profiles_aiu
    AFTER UPDATE OF name ON public.organizations
    FOR EACH ROW EXECUTE PROCEDURE public.trg_organizations_name_to_profiles();
  END IF;
END $$;

commit;
