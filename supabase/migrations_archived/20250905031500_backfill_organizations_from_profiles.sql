-- Backfill organizations and organization_members from profiles.company_name
-- Idempotent: safe to run multiple times.

begin;

-- 1) Create organizations for distinct, non-empty company names
with distinct_companies as (
  select distinct trim(company_name) as name
  from public.profiles
  where company_name is not null and length(trim(company_name)) > 0
)
insert into public.organizations (name)
select name from distinct_companies
on conflict do nothing; -- rely on unique slug/name constraints

-- 2) If any profiles had a stored brevo_company_id, propagate the first known value
--    to the corresponding organization when org.brevo_company_id is still null
with by_slug as (
  select public.slugify(trim(company_name)) as slug,
         max(brevo_company_id) filter (where brevo_company_id is not null) as brevo_company_id
  from public.profiles
  where company_name is not null and length(trim(company_name)) > 0
  group by 1
)
update public.organizations o
set brevo_company_id = b.brevo_company_id,
    updated_at = now()
from by_slug b
where o.slug = b.slug
  and o.brevo_company_id is null
  and b.brevo_company_id is not null;

-- 3) Create memberships for all users whose profiles reference a company
insert into public.organization_members (organization_id, user_id, role)
select o.id, p.id, 'member'
from public.profiles p
join public.organizations o
  on o.slug = public.slugify(trim(p.company_name))
left join public.organization_members m
  on m.organization_id = o.id and m.user_id = p.id
where p.company_name is not null
  and length(trim(p.company_name)) > 0
  and m.user_id is null;

commit;
