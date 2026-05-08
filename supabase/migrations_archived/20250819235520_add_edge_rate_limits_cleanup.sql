-- Add daily retention job for edge_rate_limits using pg_cron
-- Ensures pg_cron is available in the extensions schema (Supabase default)
create extension if not exists pg_cron with schema extensions;

-- Create a small helper function we can schedule safely
create or replace function public.cleanup_edge_rate_limits()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.edge_rate_limits
  where created_at < now() - interval '30 days';
$$;

comment on function public.cleanup_edge_rate_limits() is 'Deletes edge_rate_limits rows older than 30 days';

-- Schedule a daily job at 02:00 UTC, if not already present
-- pg_cron stores jobs in the cron.job catalog; guard against duplicates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'edge_rate_limits_cleanup_daily'
  ) THEN
    PERFORM cron.schedule(
      'edge_rate_limits_cleanup_daily',
      '0 2 * * *',
      $cron$select public.cleanup_edge_rate_limits();$cron$
    );
  END IF;
END
$$;
