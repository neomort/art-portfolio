-- Add hourly timestamps to inquiries for hourly bookings
alter table if exists public.inquiries
  add column if not exists start_at timestamptz,
  add column if not exists end_at timestamptz;

comment on column public.inquiries.start_at is 'Start timestamp (local converted to UTC) for hourly inquiries';
comment on column public.inquiries.end_at is 'End timestamp (local converted to UTC) for hourly inquiries';
