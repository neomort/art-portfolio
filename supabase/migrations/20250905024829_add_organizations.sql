-- Organizations and memberships schema for org-centric model
-- Created at: 2025-09-05 02:48:29 UTC

-- Ensure gen_random_uuid is available
create extension if not exists pgcrypto;

-- Updated-at trigger helper
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Slugify helper (simple)
create or replace function public.slugify(txt text)
returns text language sql immutable as $$
  select regexp_replace(lower(trim(regexp_replace($1, '\\s+', ' ', 'g'))), '[^a-z0-9]+', '-', 'g')
$$;

-- 1) Organizations
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  brevo_company_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists organizations_name_idx on public.organizations (lower(name));

create or replace function public.organizations_set_defaults()
returns trigger language plpgsql as $$
begin
  if new.slug is null or new.slug = '' then
    new.slug = public.slugify(new.name);
  end if;
  return new;
end;
$$;

drop trigger if exists organizations_biu_defaults on public.organizations;
create trigger organizations_biu_defaults
before insert or update on public.organizations
for each row execute procedure public.organizations_set_defaults();

drop trigger if exists organizations_updated_at on public.organizations;
create trigger organizations_updated_at
before update on public.organizations
for each row execute procedure public.set_updated_at();

-- 2) Organization memberships (many-to-many users<->orgs)
create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index if not exists organization_members_user_idx on public.organization_members (user_id);
create index if not exists organization_members_org_idx on public.organization_members (organization_id);
