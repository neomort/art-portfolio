-- Finalize move of business_type to organizations by dropping from profiles
begin;

alter table if exists public.profiles
  drop column if exists business_type;

commit;
