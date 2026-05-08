-- Create table to track automated review reminders and supporting helpers
create table public.review_reminders (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  guest_id uuid not null references public.profiles(id) on delete cascade,
  reminder_type text not null default 'review_first',
  scheduled_for timestamptz not null,
  processing_started_at timestamptz,
  sent_at timestamptz,
  email_request_id text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id, reminder_type)
);

comment on table public.review_reminders is 'Queue of post-booking review reminder notifications to send to guests.';
comment on column public.review_reminders.reminder_type is 'Identifier for the reminder cadence (e.g., review_first).';
comment on column public.review_reminders.processing_started_at is 'Timestamp when a worker began processing this reminder to support skip-locked leasing.';

create index review_reminders_scheduled_for_idx on public.review_reminders (scheduled_for);
create index review_reminders_sent_at_idx on public.review_reminders (sent_at);
create index review_reminders_guest_idx on public.review_reminders (guest_id);

alter table public.review_reminders enable row level security;

create policy review_reminders_service_role_all
  on public.review_reminders
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Reuse the shared updated_at trigger helper if present
create trigger review_reminders_set_updated_at
before update on public.review_reminders
for each row execute procedure public.set_updated_at();

-- Helper to compute the reminder send time (7 days after booking end)
create or replace function public.schedule_review_reminder_for_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scheduled_for timestamptz;
begin
  -- Only consider bookings that are marked completed
  if new.status is distinct from 'completed' then
    return new;
  end if;

  -- Require a guest/user and property to target
  if new.user_id is null or new.property_id is null then
    return new;
  end if;

  -- Determine when to send: prefer precise end_at when available, otherwise assume end_date at midnight
  v_scheduled_for := coalesce(new.end_at, new.end_date::timestamptz) + interval '7 days';

  -- Guard against missing timestamps (e.g., null end_date) by defaulting to now + 7 days
  if v_scheduled_for is null then
    v_scheduled_for := now() + interval '7 days';
  end if;

  insert into public.review_reminders (booking_id, property_id, guest_id, scheduled_for)
  values (new.id, new.property_id, new.user_id, v_scheduled_for)
  on conflict (booking_id, reminder_type) do update
    set property_id = excluded.property_id,
        guest_id = excluded.guest_id,
        scheduled_for = excluded.scheduled_for,
        processing_started_at = null,
        error_message = null,
        updated_at = now()
    where review_reminders.sent_at is null;

  return new;
end;
$$;

comment on function public.schedule_review_reminder_for_booking() is 'Ensures a review reminder is queued whenever a booking is completed.';

drop trigger if exists bookings_schedule_review_reminder on public.bookings;
create trigger bookings_schedule_review_reminder
after insert or update on public.bookings
for each row execute function public.schedule_review_reminder_for_booking();

-- RPC-style helper for edge function workers to safely lock and retrieve due reminders
create or replace function public.dequeue_due_review_reminders(p_limit integer default 20)
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
  guest_name text
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
      and scheduled_for <= now()
      and (processing_started_at is null or processing_started_at < now() - interval '15 minutes')
    order by review_reminders.scheduled_for
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
    prof.full_name as guest_name
  from updated u
  join public.bookings b on b.id = u.booking_id
  join public.properties p on p.id = u.property_id
  join public.profiles prof on prof.id = u.guest_id;
end;
$$;

comment on function public.dequeue_due_review_reminders(integer) is 'Locks and returns due review reminders for processing workers, resetting processing timers for retries.';
