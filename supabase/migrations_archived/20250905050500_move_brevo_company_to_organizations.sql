-- Move Brevo company linkage from profiles to organizations
-- Idempotent and safe to re-run.

begin;

-- 1) From profiles.primary_organization_id -> organizations.brevo_company_id
with src as (
  select p.primary_organization_id as org_id,
         max(p.brevo_company_id) filter (where p.brevo_company_id is not null and length(p.brevo_company_id) > 0) as brevo_company_id
  from public.profiles p
  where p.primary_organization_id is not null
  group by 1
)
update public.organizations o
set brevo_company_id = s.brevo_company_id,
    updated_at = now()
from src s
where o.id = s.org_id
  and s.brevo_company_id is not null
  and (o.brevo_company_id is distinct from s.brevo_company_id);

-- 2) (Removed) Fallback via profiles.company_name no longer applicable; column removed in previous migrations.

-- 3) Drop the legacy column from profiles
alter table if exists public.profiles
  drop column if exists brevo_company_id;

commit;
