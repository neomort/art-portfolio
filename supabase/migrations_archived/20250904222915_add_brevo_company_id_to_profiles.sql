-- Add brevo_company_id to profiles for linking to Brevo CRM Company records
-- Safe to run multiple times
alter table if exists public.profiles
  add column if not exists brevo_company_id text;
