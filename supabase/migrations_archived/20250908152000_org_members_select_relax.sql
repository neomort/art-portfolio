-- Temporary fix: avoid recursion by relaxing SELECT policy on organization_members
-- NOTE: This allows any authenticated user to SELECT rows from organization_members.
-- We keep INSERT/UPDATE/DELETE restricted. Follow-up will re-tighten once we add a non-recursive admin check.
BEGIN;

DROP POLICY IF EXISTS org_members_select ON public.organization_members;
CREATE POLICY org_members_select
ON public.organization_members
FOR SELECT TO authenticated
USING (true);

COMMIT;
