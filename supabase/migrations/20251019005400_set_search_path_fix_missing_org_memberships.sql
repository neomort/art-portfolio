-- Pin search_path for fix_missing_org_memberships to avoid mutable path warnings
BEGIN;

DO $$
DECLARE
  fn regprocedure;
BEGIN
  SELECT to_regprocedure('public.fix_missing_org_memberships()') INTO fn;
  IF fn IS NOT NULL THEN
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', fn);
  END IF;
END;
$$;

COMMIT;
