-- Organization-level inquiry form definitions stored as Survey JSON
begin;

create table if not exists public.organization_inquiry_forms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  survey_json jsonb not null default '{}'::jsonb,
  version int not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid null references public.profiles(id)
);

-- Enable RLS
alter table public.organization_inquiry_forms enable row level security;

-- Select for all org members
do $$
begin
  create policy oif_select on public.organization_inquiry_forms
    for select using (
      exists (
        select 1 from public.organization_members m
        where m.organization_id = organization_inquiry_forms.organization_id
          and m.user_id = auth.uid()
      )
    );
exception when duplicate_object then null;
end $$;

-- Insert/Update/Delete for owners/admins
-- Insert
do $$
begin
  create policy oif_insert on public.organization_inquiry_forms
    for insert with check (
      exists (
        select 1 from public.organization_members m
        where m.organization_id = organization_inquiry_forms.organization_id
          and m.user_id = auth.uid()
          and m.role in ('owner','admin')
      )
    );
exception when duplicate_object then null;
end $$;

-- Update
do $$
begin
  create policy oif_update on public.organization_inquiry_forms
    for update using (
      exists (
        select 1 from public.organization_members m
        where m.organization_id = organization_inquiry_forms.organization_id
          and m.user_id = auth.uid()
          and m.role in ('owner','admin')
      )
    );
exception when duplicate_object then null;
end $$;

-- Delete
do $$
begin
  create policy oif_delete on public.organization_inquiry_forms
    for delete using (
      exists (
        select 1 from public.organization_members m
        where m.organization_id = organization_inquiry_forms.organization_id
          and m.user_id = auth.uid()
          and m.role in ('owner','admin')
      )
    );
exception when duplicate_object then null;
end $$;

commit;
