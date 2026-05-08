-- Set default position to 10 for FAQ categories and entries
-- Also normalize existing rows that currently have 0 to 10

alter table if exists public.faq_categories
  alter column position set default 10;

alter table if exists public.faq_entries
  alter column position set default 10;

-- Optional data normalization
update public.faq_categories set position = 10 where position = 0;
update public.faq_entries set position = 10 where position = 0;
