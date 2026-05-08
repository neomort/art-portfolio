create table if not exists public.pending_inquiries (
    id uuid primary key default uuid_generate_v4(),
    token uuid not null unique,
    property_id uuid not null references public.properties (id) on delete cascade,
    payload jsonb not null,
    guest_email text,
    guest_name text,
    redirect_path text,
    claimed boolean not null default false,
    claimed_at timestamptz,
    claimed_by uuid references public.profiles (id),
    inquiry_id uuid references public.inquiries (id),
    created_at timestamptz not null default timezone('utc', now()),
    expires_at timestamptz not null default (timezone('utc', now()) + interval '30 days')
);

alter table public.pending_inquiries enable row level security;

create policy "pending_inquiries_allow_insert_anon"
    on public.pending_inquiries
    for insert
    with check (true);

create policy "pending_inquiries_service_select"
    on public.pending_inquiries
    for select
    using ((auth.jwt() ->> 'role') = 'service_role');

create policy "pending_inquiries_service_update"
    on public.pending_inquiries
    for update
    using ((auth.jwt() ->> 'role') = 'service_role')
    with check ((auth.jwt() ->> 'role') = 'service_role');

create policy "pending_inquiries_service_delete"
    on public.pending_inquiries
    for delete
    using ((auth.jwt() ->> 'role') = 'service_role');

create index pending_inquiries_token_idx on public.pending_inquiries (token);
create index pending_inquiries_property_idx on public.pending_inquiries (property_id);
create index pending_inquiries_expires_idx on public.pending_inquiries (expires_at);
