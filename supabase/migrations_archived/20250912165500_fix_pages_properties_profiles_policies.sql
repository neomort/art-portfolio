-- Harden and reassert public read for pages/properties/reviews and authenticated self-access for profiles
-- Also reload PostgREST schema cache.

begin;

-- Base grants
grant usage on schema public to anon, authenticated;

-- Pages: public read
grant select on public.pages to anon, authenticated;
alter table public.pages enable row level security;
drop policy if exists pages_public_read on public.pages;
create policy pages_public_read
  on public.pages
  for select
  to anon, authenticated
  using (true);

-- Properties: public read when published
grant select on public.properties to anon, authenticated;
alter table public.properties enable row level security;
drop policy if exists properties_public_published on public.properties;
create policy properties_public_published
  on public.properties
  for select
  to anon, authenticated
  using (published = true);

-- Reviews: public read when approved (for embeds in selects)
grant select on public.reviews to anon, authenticated;
alter table public.reviews enable row level security;
drop policy if exists reviews_public_approved on public.reviews;
create policy reviews_public_approved
  on public.reviews
  for select
  to anon, authenticated
  using (status = 'approved');

-- Profiles: authenticated self-only
grant select, insert, update on public.profiles to authenticated;
alter table public.profiles enable row level security;
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

-- Reload PostgREST to pick up changes
notify pgrst, 'reload schema';

commit;
