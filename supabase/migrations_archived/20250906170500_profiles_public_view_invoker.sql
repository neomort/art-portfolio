-- Ensure profiles_public_view uses SECURITY INVOKER, not SECURITY DEFINER
BEGIN;

-- Switch the view to SECURITY INVOKER (Postgres 15+ syntax)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_views
    WHERE schemaname = 'public'
      AND viewname = 'profiles_public_view'
  ) THEN
    EXECUTE 'ALTER VIEW public.profiles_public_view SET (security_invoker = on)';
  END IF;
END $$;

COMMIT;
