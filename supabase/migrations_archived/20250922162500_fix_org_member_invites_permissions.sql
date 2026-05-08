-- Permissions and RLS for organization_member_invites so org members can view invites
-- and org owners/admins can manage them.

begin;

-- Base grants (in addition to RLS policies)
GRANT SELECT ON public.organization_member_invites TO authenticated;
GRANT ALL ON public.organization_member_invites TO service_role;

-- Ensure RLS is enabled
ALTER TABLE public.organization_member_invites ENABLE ROW LEVEL SECURITY;

-- Clean up any conflicting legacy policies
DROP POLICY IF EXISTS "invites_read_members" ON public.organization_member_invites;
DROP POLICY IF EXISTS "invites_manage_admins" ON public.organization_member_invites;
DROP POLICY IF EXISTS "org_invites_select" ON public.organization_member_invites;
DROP POLICY IF EXISTS "org_invites_insert" ON public.organization_member_invites;
DROP POLICY IF EXISTS "org_invites_delete" ON public.organization_member_invites;
DROP POLICY IF EXISTS "org_invites_update" ON public.organization_member_invites;

-- SELECT: allow any authenticated user who is a member of the organization to read invites
CREATE POLICY "org_invites_select"
ON public.organization_member_invites
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = organization_member_invites.organization_id
      AND om.user_id = auth.uid()
  )
);

-- INSERT: allow owners/admins of the organization to create invites
CREATE POLICY "org_invites_insert"
ON public.organization_member_invites
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = organization_member_invites.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner','admin')
  )
);

-- DELETE: allow owners/admins of the organization to delete invites
CREATE POLICY "org_invites_delete"
ON public.organization_member_invites
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = organization_member_invites.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner','admin')
  )
);

-- UPDATE (optional): allow owners/admins to update invite role/email if needed
CREATE POLICY "org_invites_update"
ON public.organization_member_invites
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = organization_member_invites.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner','admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = organization_member_invites.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner','admin')
  )
);

commit;
