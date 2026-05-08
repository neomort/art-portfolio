-- RLS policies for FAQ tables and small dev seed
-- Assumes admin users are identified by profiles.is_admin = true

-- Enable Row Level Security
alter table if exists public.faq_categories enable row level security;
alter table if exists public.faq_entries enable row level security;

-- Helper: check if current user is admin
-- We will use this expression in policies:
--   exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)

-- Categories: public read
drop policy if exists "Public can read categories" on public.faq_categories;
create policy "Public can read categories"
  on public.faq_categories
  for select
  to anon, authenticated
  using (true);

-- Categories: admins full access (insert/update/delete/select)
drop policy if exists "Admins manage categories" on public.faq_categories;
create policy "Admins manage categories"
  on public.faq_categories
  for all
  to authenticated
  using (exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
  with check (exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

-- Entries: public can read only published = true
drop policy if exists "Public can read published entries" on public.faq_entries;
create policy "Public can read published entries"
  on public.faq_entries
  for select
  to anon, authenticated
  using (published = true);

-- Entries: admins full access
drop policy if exists "Admins manage entries" on public.faq_entries;
create policy "Admins manage entries"
  on public.faq_entries
  for all
  to authenticated
  using (exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
  with check (exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

-- Optional: grant usage to public schema if needed (usually already present)
-- grant usage on schema public to anon, authenticated;

-- Small idempotent seed for dev/testing
insert into public.faq_categories (slug, title, position)
values
  ('getting-started', 'Getting Started', 2)
on conflict (slug) do nothing;

insert into public.faq_entries (category_id, question, answer_md, tags, position, published)
select c.id,
       'How do I contact support?',
       'You can reach support at support@splitspace.com. We typically respond within 1 business day.',
       '{support,contact}',
       2,
       true
from public.faq_categories c
where c.slug = 'getting-started'
on conflict do nothing;
