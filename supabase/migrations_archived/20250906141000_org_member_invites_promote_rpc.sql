-- RPC to manually promote invites to members by email
BEGIN;

CREATE OR REPLACE FUNCTION public.promote_invites_for_email(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
BEGIN
  IF p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RETURN;
  END IF;

  -- Find a profile with matching email
  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE lower(email) = lower(p_email)
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    -- Nothing to do if no profile yet
    RETURN;
  END IF;

  -- Upsert membership(s)
  INSERT INTO public.organization_members (organization_id, user_id, role)
  SELECT imi.organization_id, v_profile_id, imi.role
  FROM public.organization_member_invites imi
  WHERE lower(imi.email) = lower(p_email)
  ON CONFLICT (organization_id, user_id)
  DO UPDATE SET role = EXCLUDED.role;

  -- Mark invites accepted
  UPDATE public.organization_member_invites
  SET accepted_at = now()
  WHERE lower(email) = lower(p_email)
    AND accepted_at IS NULL;
END;
$$;

ALTER FUNCTION public.promote_invites_for_email(text) OWNER TO postgres;

COMMIT;
