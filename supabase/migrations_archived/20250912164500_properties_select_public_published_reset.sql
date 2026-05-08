-- Reset properties select policies to ensure anonymous can read published listings
-- and refresh PostgREST schema cache.

begin;

-- Ensure RLS enabled
alter table public.properties enable row level security;

-- Ensure grants for API roles
grant usage on schema public to anon, authenticated;
grant select on public.properties to anon, authenticated;

-- Drop potentially conflicting select policies
drop policy if exists properties_select_all on public.properties;
drop policy if exists properties_select_org on public.properties;
drop policy if exists properties_public_published on public.properties;

-- Recreate the public published-only select policy
create policy properties_public_published
  on public.properties
  for select
  to anon, authenticated
  using (published = true);

-- Reviews embed must also be accessible publicly (approved only)
alter table public.reviews enable row level security;
grant select on public.reviews to anon, authenticated;
drop policy if exists reviews_public_approved on public.reviews;
create policy reviews_public_approved
  on public.reviews
  for select
  to anon, authenticated
  using (status = 'approved');

-- Reload PostgREST to pick up changes promptly
notify pgrst, 'reload schema';

commit;
