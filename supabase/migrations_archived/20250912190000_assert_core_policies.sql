-- Assert core GRANTs and RLS policies for authenticated and public flows
-- Idempotent: uses DROP POLICY IF EXISTS before CREATE POLICY
-- Includes public visibility for bookings on published properties per product decision

begin;

-- Base schema usage for public endpoints
grant usage on schema public to anon, authenticated;

/* Shared dependency: organization_members
   Must be readable so EXISTS subqueries in other policies can evaluate without 42501 */
grant select on public.organization_members to anon, authenticated;
alter table public.organization_members enable row level security;

drop policy if exists org_members_select_own on public.organization_members;
create policy org_members_select_own
  on public.organization_members
  for select
  to authenticated
  using (user_id = auth.uid());

/* favorites: authenticated-only own rows */
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

/* inquiries: participant-only reads */
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

/* messages: participant-only reads (embedded in inquiries) */
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
        and (i.user_id = auth.uid() or p.venue_id = auth.uid())
    )
  );

/* proposals: participant-only reads (embedded in bookings/inquiries) */
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
        and (i.user_id = auth.uid() or p.venue_id = auth.uid())
    )
  );

/* bookings: participant-only reads + public visibility for published properties */
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
        and (i.user_id = auth.uid() or p.venue_id = auth.uid())
    )
  );

-- Public: show bookings for published properties so anonymous users can see availability
-- This exposes booking ranges but not sensitive fields beyond what is selected by clients
-- Keep client selects minimal (e.g., start_at/end_at/status) when using anon

drop policy if exists bookings_public_if_published on public.bookings;
create policy bookings_public_if_published
  on public.bookings
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.proposals pr
      join public.inquiries i on i.id = pr.inquiry_id
      join public.properties p on p.id = i.property_id
      where pr.id = bookings.proposal_id
        and p.published = true
        and p.id = bookings.property_id
    )
  );

/* organizations: authenticated read (embedded in profiles/properties) */
grant select on public.organizations to authenticated;
alter table public.organizations enable row level security;

drop policy if exists organizations_select_authenticated on public.organizations;
create policy organizations_select_authenticated
  on public.organizations
  for select
  to authenticated
  using (true);

/* organization_adjustments: org member read (profile/org pages) */
grant select on public.organization_adjustments to authenticated;
alter table public.organization_adjustments enable row level security;

drop policy if exists org_adjustments_select_member on public.organization_adjustments;
create policy org_adjustments_select_member
  on public.organization_adjustments
  for select
  to authenticated
  using (
    exists (
      select 1 from public.organization_members om
      where om.organization_id = organization_adjustments.organization_id
        and om.user_id = auth.uid()
        and om.role in ('owner','admin','member')
    )
  );

/* review_responses: public read only for approved parent reviews */
grant select on public.review_responses to anon, authenticated;
alter table public.review_responses enable row level security;

drop policy if exists review_responses_public_for_approved_reviews on public.review_responses;
create policy review_responses_public_for_approved_reviews
  on public.review_responses
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.reviews r
      where r.id = review_responses.review_id
        and r.status = 'approved'
    )
  );

/* profiles: keep authenticated-only, self-access per product decision */
revoke select on public.profiles from anon;
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

-- Refresh PostgREST cache
notify pgrst, 'reload schema';

commit;
