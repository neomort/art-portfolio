-- Auto-convert organization_member_invites -> organization_members when a matching profiles.email appears
BEGIN;

-- Create conversion trigger function (SECURITY DEFINER) to bypass RLS safely
CREATE OR REPLACE FUNCTION public.convert_invites_for_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_profile_id uuid;
BEGIN
  v_profile_id := NEW.id;
  v_email := NEW.email;

  IF v_email IS NULL OR length(trim(v_email)) = 0 THEN
    RETURN NEW;
  END IF;

  -- Upsert members for all invites matching this email
  INSERT INTO public.organization_members (organization_id, user_id, role)
  SELECT imi.organization_id, v_profile_id, imi.role
  FROM public.organization_member_invites imi
  WHERE lower(imi.email) = lower(v_email)
  ON CONFLICT (organization_id, user_id)
  DO UPDATE SET role = EXCLUDED.role;

  -- Mark invites accepted
  UPDATE public.organization_member_invites imi
  SET accepted_at = now()
  WHERE lower(imi.email) = lower(v_email)
    AND accepted_at IS NULL;

  RETURN NEW;
END;
$$;

-- Ensure owner is postgres to safely run with SECURITY DEFINER
ALTER FUNCTION public.convert_invites_for_profile() OWNER TO postgres;

-- Trigger on profiles insert
DROP TRIGGER IF EXISTS trg_convert_invites_on_profile_insert ON public.profiles;
CREATE TRIGGER trg_convert_invites_on_profile_insert
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.convert_invites_for_profile();

-- Trigger on profiles update (email change)
DROP TRIGGER IF EXISTS trg_convert_invites_on_profile_update ON public.profiles;
CREATE TRIGGER trg_convert_invites_on_profile_update
AFTER UPDATE OF email ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.convert_invites_for_profile();

COMMIT;
