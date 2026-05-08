-- Add profiles.password_set to track whether a user created a password (light accounts default to false)

alter table if exists public.profiles
  add column if not exists password_set boolean default false;

update public.profiles
  set password_set = coalesce(password_set, false)
where password_set is null;

alter table public.profiles
  alter column password_set set not null;

comment on column public.profiles.password_set is
  'True if the user has set a password; false for magic-link-only light accounts.';
