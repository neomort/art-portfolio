-- Ensure pgcrypto is available for gen_random_uuid()
create extension if not exists pgcrypto;

-- Create a simple audit table to support rate limiting across Edge Function instances
create table if not exists public.edge_rate_limits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  ip text,
  function text not null,
  created_at timestamptz not null default now()
);

-- Helpful indexes for counting recent invocations quickly
create index if not exists edge_rate_limits_user_func_created_at_idx
  on public.edge_rate_limits (user_id, function, created_at desc);

create index if not exists edge_rate_limits_ip_func_created_at_idx
  on public.edge_rate_limits (ip, function, created_at desc);

-- Tighten perms: only service role (Edge Functions) should write; reads allowed to service role only
revoke all on table public.edge_rate_limits from anon, authenticated;

-- Optionally, add a retention policy via a scheduled job outside of this migration.
-- For example, you can periodically delete rows older than 30 days to keep the table small.
