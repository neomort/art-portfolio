-- Adds review submission tracking to review_reminders and keeps reminders in sync with reviews

-- 1. Columns to track review completion
alter table public.review_reminders
  add column if not exists review_submitted_at timestamptz,
  add column if not exists review_id uuid references public.reviews(id) on delete set null;

comment on column public.review_reminders.review_submitted_at is 'When the guest submitted an actual review (if available).';
comment on column public.review_reminders.review_id is 'Reference to the review record submitted by the guest (if available).';

create index if not exists review_reminders_review_id_idx on public.review_reminders(review_id);

-- 2. Backfill existing reminders using the most recent review per (booking, guest)
with latest_reviews as (
  select
    rr.id as reminder_id,
    r.id as review_id,
    r.created_at,
    row_number() over (
      partition by rr.id
      order by r.created_at desc
    ) as rn
  from public.review_reminders rr
  join public.reviews r
    on r.property_id = rr.property_id
   and r.reviewer_id = rr.guest_id
)
update public.review_reminders rr
set review_submitted_at = lr.created_at,
    review_id = lr.review_id,
    updated_at = now()
from latest_reviews lr
where rr.id = lr.reminder_id
  and lr.rn = 1
  and (rr.review_submitted_at is distinct from lr.created_at
    or rr.review_id is distinct from lr.review_id);

-- 3. Helper to resolve booking id and mark reminders once a review is created
create or replace function public.review_reminders_handle_review_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking_id uuid;
begin
  v_booking_id := null;

  -- Prefer explicit booking_id from review_eligibility JSON when provided
  begin
    if new.review_eligibility ? 'booking_id' then
      v_booking_id := nullif(new.review_eligibility->>'booking_id', '')::uuid;
    end if;
  exception when others then
    v_booking_id := null;
  end;

  -- Fallback: most recent booking for this property/user
  if v_booking_id is null then
    select b.id
      into v_booking_id
    from public.bookings b
    where b.property_id = new.property_id
      and b.user_id = new.reviewer_id
    order by coalesce(b.end_at, b.end_date::timestamptz, b.created_at) desc
    limit 1;
  end if;

  if v_booking_id is null then
    return new;
  end if;

  update public.review_reminders rr
  set review_submitted_at = new.created_at,
      review_id = new.id,
      updated_at = now()
  where rr.booking_id = v_booking_id
    and rr.guest_id = new.reviewer_id
    and rr.review_submitted_at is null;

  return new;
end;
$$;

-- 4. Clear reminder metadata if a review is removed
create or replace function public.review_reminders_handle_review_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.review_reminders rr
  set review_submitted_at = null,
      review_id = null,
      updated_at = now()
  where rr.review_id = old.id;

  return old;
end;
$$;

-- Ensure the helper is recreated with the extended return signature
drop function if exists public.dequeue_due_review_reminders(integer);

create function public.dequeue_due_review_reminders(p_limit integer default 20)
returns table (
  reminder_id uuid,
  booking_id uuid,
  reminder_type text,
  scheduled_for timestamptz,
  property_id uuid,
  property_title text,
  start_date date,
  end_date date,
  guest_id uuid,
  guest_email text,
  guest_name text,
  review_submitted_at timestamptz,
  review_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(p_limit, 0) <= 0 then
    p_limit := 20;
  end if;

  return query
  with due as (
    select id
    from public.review_reminders
    where sent_at is null
      and review_submitted_at is null
      and scheduled_for <= now()
      and (processing_started_at is null or processing_started_at < now() - interval '15 minutes')
    order by scheduled_for
    limit p_limit
    for update skip locked
  ), updated as (
    update public.review_reminders r
    set processing_started_at = now()
    from due
    where r.id = due.id
    returning r.*
  )
  select
    u.id as reminder_id,
    u.booking_id,
    u.reminder_type,
    u.scheduled_for,
    u.property_id,
    p.title as property_title,
    b.start_date,
    b.end_date,
    u.guest_id,
    prof.email as guest_email,
    prof.full_name as guest_name,
    u.review_submitted_at,
    u.review_id
  from updated u
  join public.bookings b on b.id = u.booking_id
  join public.properties p on p.id = u.property_id
  join public.profiles prof on prof.id = u.guest_id;
end;
$$;

-- 6. Attach triggers for review insert/delete events

do $$
begin
  if exists (
    select 1 from pg_trigger where tgname = 'review_reminders_after_review_insert'
  ) then
    drop trigger review_reminders_after_review_insert on public.reviews;
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1 from pg_trigger where tgname = 'review_reminders_after_review_delete'
  ) then
    drop trigger review_reminders_after_review_delete on public.reviews;
  end if;
end;
$$;

create trigger review_reminders_after_review_insert
after insert on public.reviews
for each row execute function public.review_reminders_handle_review_insert();

create trigger review_reminders_after_review_delete
after delete on public.reviews
for each row execute function public.review_reminders_handle_review_delete();
