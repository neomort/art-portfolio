-- Backfill organizations.business_type from profiles.business_type via primary_organization_id
-- Safe to re-run and idempotent

begin;

-- Prefer a one-time update where org currently has null/empty business_type
update public.organizations o
set business_type = p.business_type
from public.profiles p
where p.primary_organization_id = o.id
  and coalesce(nullif(p.business_type, ''), null) is not null
  and coalesce(nullif(o.business_type, ''), null) is null;

commit;
