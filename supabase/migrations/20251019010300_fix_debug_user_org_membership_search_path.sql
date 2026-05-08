begin;

DO $$
BEGIN
  IF to_regprocedure('public.debug_user_org_membership()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.debug_user_org_membership() SET search_path = public';
  END IF;
END;
$$;

commit;
