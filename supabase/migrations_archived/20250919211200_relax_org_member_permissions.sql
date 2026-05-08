-- Relax permissions so any organization member can rename the organization and edit properties
-- This migration adjusts RLS policies to allow any membership (role: member|admin|owner)
-- to update organizations.name (via UPDATE on organizations) and update properties.

BEGIN;

-- Organizations: allow SELECT and UPDATE to any org member (or site admin)
-- Drop existing policies that may conflict
DROP POLICY IF EXISTS orgs_select_member_or_admin ON public.organizations;
DROP POLICY IF EXISTS orgs_update_member_or_admin ON public.organizations;

-- Recreate SELECT policy: any member or site admin can view
CREATE POLICY orgs_select_member_or_admin
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organizations.id
        AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

-- Recreate UPDATE policy: any member or site admin can update (e.g., rename)
CREATE POLICY orgs_update_member_or_admin
  ON public.organizations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organizations.id
        AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organizations.id
        AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

-- Properties: allow UPDATE to any org member (not only owner/admin)
-- Drop and recreate the policy from 20250905062500_properties_add_org_id_and_policies.sql
DROP POLICY IF EXISTS properties_update_org ON public.properties;

CREATE POLICY properties_update_org
  ON public.properties FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = properties.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner','admin','member')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = properties.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner','admin','member')
    )
  );

COMMIT;
