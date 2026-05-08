begin;

CREATE OR REPLACE FUNCTION public.is_org_member_with_role(org_id uuid, allowed_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = org_id
      AND om.user_id = auth.uid()
      AND (om.role = ANY(allowed_roles))
  );
$$;

commit;
