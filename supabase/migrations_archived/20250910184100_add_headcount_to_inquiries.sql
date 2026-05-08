-- Add headcount column to inquiries
alter table if exists public.inquiries
  add column if not exists headcount integer;

comment on column public.inquiries.headcount is 'Estimated attendee count provided during inquiry. Used for capacity surcharge calculations.';
