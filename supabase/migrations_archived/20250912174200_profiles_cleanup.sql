-- Cleanup: enforce authenticated-only profiles
-- Drop any public-read policy on profiles and revoke anon table select

begin;

-- Revoke direct table read from anon (RLS still blocks, but this hardens grants)
revoke select on public.profiles from anon;

-- Drop any known/legacy public-read policy names
drop policy if exists profiles_public_read on public.profiles;
-- In case other names were used historically
drop policy if exists profiles_select_public_min on public.profiles;

-- Ensure intended self-access remains
grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
alter table public.profiles enable row level security;

-- Recreate self policies idempotently
-- (Safe if they already exist from the assert-final-state migration)
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Reload PostgREST
notify pgrst, 'reload schema';

commit;
