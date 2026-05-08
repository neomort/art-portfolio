-- Non-recursive helper functions and policies to fix infinite recursion on organization_members
BEGIN;

-- Helper: is_org_member(org_id)
CREATE OR REPLACE FUNCTION public.is_org_member(org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = org_id
      AND om.user_id = auth.uid()
  );
$$;

-- Helper: is_org_admin(org_id)
CREATE OR REPLACE FUNCTION public.is_org_admin(org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = org_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner','admin')
  );
$$;

-- Recreate organization_members policies using helper functions to avoid self-referential recursion
DROP POLICY IF EXISTS org_members_select ON public.organization_members;
CREATE POLICY org_members_select
ON public.organization_members
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_org_admin(organization_members.organization_id)
  OR public.is_platform_admin()
);

DROP POLICY IF EXISTS org_members_insert ON public.organization_members;
CREATE POLICY org_members_insert
ON public.organization_members
FOR INSERT TO authenticated
WITH CHECK (
  public.is_org_admin(organization_members.organization_id)
  OR public.is_platform_admin()
);

DROP POLICY IF EXISTS org_members_update ON public.organization_members;
CREATE POLICY org_members_update
ON public.organization_members
FOR UPDATE TO authenticated
USING (
  public.is_org_admin(organization_members.organization_id)
  OR public.is_platform_admin()
)
WITH CHECK (
  public.is_org_admin(organization_members.organization_id)
  OR public.is_platform_admin()
);

DROP POLICY IF EXISTS org_members_delete ON public.organization_members;
CREATE POLICY org_members_delete
ON public.organization_members
FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_org_admin(organization_members.organization_id)
  OR public.is_platform_admin()
);

-- Update organization_member_invites policies to use helper functions too (avoid recursion path)
DROP POLICY IF EXISTS org_invites_select ON public.organization_member_invites;
CREATE POLICY org_invites_select
ON public.organization_member_invites
FOR SELECT TO authenticated
USING (
  public.is_org_member(organization_member_invites.organization_id)
  OR public.is_platform_admin()
);

DROP POLICY IF EXISTS org_invites_insert ON public.organization_member_invites;
CREATE POLICY org_invites_insert
ON public.organization_member_invites
FOR INSERT TO authenticated
WITH CHECK (
  public.is_org_admin(organization_member_invites.organization_id)
  OR public.is_platform_admin()
);

DROP POLICY IF EXISTS org_invites_delete ON public.organization_member_invites;
CREATE POLICY org_invites_delete
ON public.organization_member_invites
FOR DELETE TO authenticated
USING (
  public.is_org_admin(organization_member_invites.organization_id)
  OR public.is_platform_admin()
);

COMMIT;
