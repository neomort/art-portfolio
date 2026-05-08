-- Pin search_path for debug_user_org_membership to avoid mutable path issues
BEGIN;

DO $$
DECLARE
  fn regprocedure;
BEGIN
  SELECT to_regprocedure('public.debug_user_org_membership(uuid)') INTO fn;
  IF fn IS NOT NULL THEN
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', fn);
  END IF;
END;
$$;

COMMIT;
