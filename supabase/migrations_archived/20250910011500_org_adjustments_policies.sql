-- RLS policies for organization_adjustments so org owners/admins can manage rows
-- and org members can read them.

-- Helper: check if current user is a member of an organization with one of the allowed roles
CREATE OR REPLACE FUNCTION public.is_org_member_with_role(org_id uuid, allowed_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = org_id
      AND om.user_id = auth.uid()
      AND (om.role = ANY(allowed_roles))
  );
$$;

-- Tighten SELECT policy: only members of the organization may read
DO $$ BEGIN
  DROP POLICY IF EXISTS org_adjustments_select ON public.organization_adjustments;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

CREATE POLICY org_adjustments_select
  ON public.organization_adjustments
  FOR SELECT
  USING (
    public.is_org_member_with_role(organization_id, ARRAY['owner','admin','member']::text[])
  );

-- Allow INSERT for owners/admins of the target org
DO $$ BEGIN
  DROP POLICY IF EXISTS org_adjustments_insert ON public.organization_adjustments;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

CREATE POLICY org_adjustments_insert
  ON public.organization_adjustments
  FOR INSERT
  WITH CHECK (
    public.is_org_member_with_role(organization_id, ARRAY['owner','admin']::text[])
  );

-- Allow UPDATE for owners/admins (row stays in same org)
DO $$ BEGIN
  DROP POLICY IF EXISTS org_adjustments_update ON public.organization_adjustments;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

CREATE POLICY org_adjustments_update
  ON public.organization_adjustments
  FOR UPDATE
  USING (
    public.is_org_member_with_role(organization_id, ARRAY['owner','admin']::text[])
  )
  WITH CHECK (
    public.is_org_member_with_role(organization_id, ARRAY['owner','admin']::text[])
  );

-- Allow DELETE for owners/admins
DO $$ BEGIN
  DROP POLICY IF EXISTS org_adjustments_delete ON public.organization_adjustments;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

CREATE POLICY org_adjustments_delete
  ON public.organization_adjustments
  FOR DELETE
  USING (
    public.is_org_member_with_role(organization_id, ARRAY['owner','admin']::text[])
  );
