-- Ensure all public functions explicitly set search_path=public to avoid search_path hijacking warnings
BEGIN;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema,
           p.proname AS name,
           oidvectortypes(p.proargtypes) AS args,
           p.oid,
           p.proconfig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f' -- normal function (includes trigger functions)
      AND (
        p.proconfig IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%'
        )
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %I.%I(%s) SET search_path = public', r.schema, r.name, r.args);
  END LOOP;
END $$;

COMMIT;
