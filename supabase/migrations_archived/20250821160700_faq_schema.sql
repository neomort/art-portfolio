-- FAQ schema with FTS
create extension if not exists pgcrypto;

create table if not exists public.faq_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.faq_entries (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.faq_categories(id) on delete set null,
  question text not null,
  answer_md text not null,
  tags text[] not null default '{}',
  position int not null default 0,
  published boolean not null default true,
  search_tsv tsvector,
  created_at timestamptz not null default now()
);

create index if not exists faq_entries_category_position_idx
  on public.faq_entries (category_id, position);

create index if not exists faq_entries_tags_gin_idx
  on public.faq_entries using gin (tags);

create index if not exists faq_entries_tsv_idx
  on public.faq_entries using gin (search_tsv);

create or replace function public.faq_entries_tsv_trigger() returns trigger as $$
begin
  new.search_tsv :=
    setweight(to_tsvector('simple', coalesce(new.question,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.answer_md,'')), 'B');
  return new;
end
$$ language plpgsql;

create trigger faq_entries_tsv_update before insert or update
on public.faq_entries for each row execute function public.faq_entries_tsv_trigger();
