-- Pin search_path for trg_profiles_ensure_org_membership trigger function
BEGIN;

DO $$
DECLARE
  fn regprocedure;
BEGIN
  SELECT to_regprocedure('public.trg_profiles_ensure_org_membership()') INTO fn;
  IF fn IS NOT NULL THEN
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', fn);
  END IF;
END;
$$;

COMMIT;
