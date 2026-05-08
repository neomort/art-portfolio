-- Pin search_path for uid helper
BEGIN;

DO $$
DECLARE
  fn regprocedure;
BEGIN
  SELECT to_regprocedure('public.uid()') INTO fn;
  IF fn IS NOT NULL THEN
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', fn);
  END IF;

  SELECT to_regprocedure('public.add_creator_as_org_owner()') INTO fn;
  IF fn IS NOT NULL THEN
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', fn);
  END IF;

  SELECT to_regprocedure('public.claim_pending_inquiry_rpc(uuid, uuid, date, date, timestamptz, timestamptz, int, uuid[], text)') INTO fn;
  IF fn IS NOT NULL THEN
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', fn);
  END IF;

  SELECT to_regprocedure('public.debug_user_org_membership(uuid)') INTO fn;
  IF fn IS NOT NULL THEN
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', fn);
  END IF;

  SELECT to_regprocedure('public.is_org_member_with_role(uuid, text[])') INTO fn;
  IF fn IS NOT NULL THEN
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', fn);
  END IF;
END;
$$;

COMMIT;
