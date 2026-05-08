-- DB-side RPC to rename an organization by any member (or site admin)
-- Also updates slug with conflict retries

BEGIN;

CREATE OR REPLACE FUNCTION public.rename_organization(
  p_org_id uuid,
  p_new_name text
)
RETURNS TABLE (id uuid, name text, slug text, updated_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base_slug text;
  v_try_slug text;
  v_updated RECORD;
  v_attempt int := 1;
BEGIN
  IF p_org_id IS NULL OR coalesce(btrim(p_new_name),'') = '' THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;

  -- Ensure caller is a member or site admin
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = p_org_id AND om.user_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_base_slug := regexp_replace(lower(trim(p_new_name)), '[^a-z0-9]+', '-', 'g');
  IF v_base_slug IS NULL OR v_base_slug = '' THEN
    v_base_slug := 'org';
  END IF;

  LOOP
    v_try_slug := CASE WHEN v_attempt = 1 THEN v_base_slug ELSE v_base_slug || '-' || v_attempt::text END;
    BEGIN
      UPDATE public.organizations o
      SET name = p_new_name,
          slug = v_try_slug,
          updated_at = now()
      WHERE o.id = p_org_id
      RETURNING o.id, o.name, o.slug, o.updated_at INTO v_updated;

      EXIT; -- success
    EXCEPTION WHEN unique_violation THEN
      v_attempt := v_attempt + 1;
      IF v_attempt > 5 THEN
        RAISE;
      END IF;
    END;
  END LOOP;

  RETURN QUERY SELECT v_updated.id, v_updated.name, v_updated.slug, v_updated.updated_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rename_organization(uuid, text) TO authenticated;

COMMIT;
