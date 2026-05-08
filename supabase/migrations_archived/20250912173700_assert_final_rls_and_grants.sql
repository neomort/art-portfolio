-- Assert final GRANTs and RLS policies across core tables
-- This migration consolidates the manual fixes we verified via curl and app testing
-- Safe to run multiple times: uses DROP POLICY IF EXISTS before CREATE POLICY

begin;

-- Base schema usage
grant usage on schema public to anon, authenticated;

/* =====================
   Public content tables
   ===================== */
-- pages: public read
grant select on public.pages to anon, authenticated;
alter table public.pages enable row level security;
drop policy if exists pages_public_read on public.pages;
create policy pages_public_read
  on public.pages
  for select
  to anon, authenticated
  using (true);

-- properties: public read if published
grant select on public.properties to anon, authenticated;
alter table public.properties enable row level security;
drop policy if exists properties_public_published on public.properties;
create policy properties_public_published
  on public.properties
  for select
  to anon, authenticated
  using (published = true);

-- reviews: public read if approved
grant select on public.reviews to anon, authenticated;
alter table public.reviews enable row level security;
drop policy if exists reviews_public_approved on public.reviews;
create policy reviews_public_approved
  on public.reviews
  for select
  to anon, authenticated
  using (status = 'approved');

/* =====================
   Authenticated user data
   ===================== */
-- profiles: authenticated-only self access
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

-- favorites: own access
grant select, insert, delete on public.favorites to authenticated;
alter table public.favorites enable row level security;
drop policy if exists favorites_select_own on public.favorites;
create policy favorites_select_own
  on public.favorites
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists favorites_insert_own on public.favorites;
create policy favorites_insert_own
  on public.favorites
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists favorites_delete_own on public.favorites;
create policy favorites_delete_own
  on public.favorites
  for delete
  to authenticated
  using (user_id = auth.uid());

-- organization_members: own rows
grant select on public.organization_members to authenticated;
alter table public.organization_members enable row level security;
drop policy if exists org_members_select_own on public.organization_members;
create policy org_members_select_own
  on public.organization_members
  for select
  to authenticated
  using (user_id = auth.uid());

/* =====================
   Conversations & booking flow (participant visibility)
   ===================== */
-- inquiries: requester or venue owner
grant select on public.inquiries to authenticated;
alter table public.inquiries enable row level security;
drop policy if exists inquiries_select_participant on public.inquiries;
create policy inquiries_select_participant
  on public.inquiries
  for select
  to authenticated
  using (
    inquiries.user_id = auth.uid()
    or exists (
      select 1
      from public.properties p
      where p.id = inquiries.property_id
        and p.venue_id = auth.uid()
    )
  );

-- messages: only participants in the inquiry
grant select on public.messages to authenticated;
alter table public.messages enable row level security;
drop policy if exists messages_select_for_permitted_inquiries on public.messages;
create policy messages_select_for_permitted_inquiries
  on public.messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.inquiries i
      join public.properties p on p.id = i.property_id
      where i.id = messages.inquiry_id
        and (
          i.user_id = auth.uid()
          or p.venue_id = auth.uid()
        )
    )
  );

-- proposals: only participants
grant select on public.proposals to authenticated;
alter table public.proposals enable row level security;
drop policy if exists proposals_select_for_permitted_inquiries on public.proposals;
create policy proposals_select_for_permitted_inquiries
  on public.proposals
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.inquiries i
      join public.properties p on p.id = i.property_id
      where i.id = proposals.inquiry_id
        and (
          i.user_id = auth.uid()
          or p.venue_id = auth.uid()
        )
    )
  );

-- bookings: only participants via proposals -> inquiries -> properties
grant select on public.bookings to authenticated;
alter table public.bookings enable row level security;
drop policy if exists bookings_select_for_permitted_inquiries on public.bookings;
create policy bookings_select_for_permitted_inquiries
  on public.bookings
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.proposals pr
      join public.inquiries i on i.id = pr.inquiry_id
      join public.properties p on p.id = i.property_id
      where pr.id = bookings.proposal_id
        and (
          i.user_id = auth.uid()
          or p.venue_id = auth.uid()
        )
    )
  );

/* =====================
   Organizations & adjustments
   ===================== */
-- organizations: authenticated read (needed for embedded selects)
grant select on public.organizations to authenticated;
alter table public.organizations enable row level security;
drop policy if exists organizations_select_authenticated on public.organizations;
create policy organizations_select_authenticated
  on public.organizations
  for select
  to authenticated
  using (true);

-- organization_adjustments: member read; optional public-if-published left to earlier migration
grant select on public.organization_adjustments to authenticated;
alter table public.organization_adjustments enable row level security;
drop policy if exists org_adjustments_select_member on public.organization_adjustments;
create policy org_adjustments_select_member
  on public.organization_adjustments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = organization_adjustments.organization_id
        and om.user_id = auth.uid()
        and om.role in ('owner','admin','member')
    )
  );

/* =====================
   Schedules & availability
   ===================== */
-- property_schedule: public read if property is published; owner read
grant select on public.property_schedule to anon, authenticated;
alter table public.property_schedule enable row level security;
drop policy if exists property_schedule_public_if_published on public.property_schedule;
create policy property_schedule_public_if_published
  on public.property_schedule
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.properties p
      where p.id = property_schedule.property_id
        and p.published = true
    )
  );

drop policy if exists property_schedule_owner_read on public.property_schedule;
create policy property_schedule_owner_read
  on public.property_schedule
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.properties p
      where p.id = property_schedule.property_id
        and p.venue_id = auth.uid()
    )
  );

-- property_availability: public read if property is published
grant select on public.property_availability to anon, authenticated;
alter table public.property_availability enable row level security;
drop policy if exists property_availability_public_if_published on public.property_availability;
create policy property_availability_public_if_published
  on public.property_availability
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.properties p
      where p.id = property_availability.property_id
        and p.published = true
    )
  );

-- Reload PostgREST to avoid cache issues
notify pgrst, 'reload schema';

commit;
