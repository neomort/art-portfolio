-- Ensure add_user_to_primary_org runs with a fixed search_path
BEGIN;

DO $$
DECLARE
  fn regprocedure;
BEGIN
  SELECT to_regprocedure('public.add_user_to_primary_org()') INTO fn;
  IF fn IS NOT NULL THEN
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', fn);
  END IF;
END;
$$;

COMMIT;
