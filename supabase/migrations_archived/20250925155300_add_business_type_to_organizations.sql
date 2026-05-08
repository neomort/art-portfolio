-- Add business_type to organizations and define RLS policies
-- Safe to re-run: uses IF NOT EXISTS and exception guards

begin;

-- 1) Add column (text for now; can migrate to enum later if needed)
alter table if exists public.organizations
  add column if not exists business_type text;

-- 2) Optional: basic check constraint (commented out for flexibility)
-- alter table public.organizations
--   add constraint organizations_business_type_check
--   check (business_type is null or business_type in ('merchant','venue','other'));

-- 3) RLS policies to allow org members to read and owners/admins to update
-- Note: Not all Postgres versions support IF NOT EXISTS for policies; wrap in DO blocks

-- Select policy for members
do $$
begin
  create policy org_business_type_select on public.organizations
    for select
    using (
      exists (
        select 1 from public.organization_members m
        where m.organization_id = organizations.id
          and m.user_id = auth.uid()
      )
    );
exception when duplicate_object then
  -- ignore if already exists
  null;
end $$;

-- Update policy for owners/admins
do $$
begin
  create policy org_business_type_update on public.organizations
    for update
    using (
      exists (
        select 1 from public.organization_members m
        where m.organization_id = organizations.id
          and m.user_id = auth.uid()
          and m.role in ('owner','admin')
      )
    );
exception when duplicate_object then
  -- ignore if already exists
  null;
end $$;

commit;
