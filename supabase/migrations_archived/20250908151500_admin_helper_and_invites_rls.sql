-- Helper function + RLS fixes for org members and invites
BEGIN;

-- 1) Helper: platform admin check without RLS recursion
-- Runs as definer (schema owner) with search_path locked to public
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_admin = true
  );
$$;

-- 2) Enable RLS on invites
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='organization_member_invites'
  ) THEN
    EXECUTE 'ALTER TABLE public.organization_member_invites ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- 3) Invites policies (SELECT for org members; INSERT/DELETE for owners/admins; admin bypass)
DROP POLICY IF EXISTS org_invites_select ON public.organization_member_invites;
CREATE POLICY org_invites_select
ON public.organization_member_invites
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = organization_member_invites.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.is_platform_admin()
);

DROP POLICY IF EXISTS org_invites_insert ON public.organization_member_invites;
CREATE POLICY org_invites_insert
ON public.organization_member_invites
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = organization_member_invites.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner','admin')
  )
  OR public.is_platform_admin()
);

DROP POLICY IF EXISTS org_invites_delete ON public.organization_member_invites;
CREATE POLICY org_invites_delete
ON public.organization_member_invites
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = organization_member_invites.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner','admin')
  )
  OR public.is_platform_admin()
);

-- 4) Update organization_members policies to use helper to avoid RLS recursion on profiles
DROP POLICY IF EXISTS org_members_select ON public.organization_members;
CREATE POLICY org_members_select
ON public.organization_members
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.organization_members om_admin
    WHERE om_admin.organization_id = organization_members.organization_id
      AND om_admin.user_id = auth.uid()
      AND om_admin.role IN ('owner','admin')
  )
  OR public.is_platform_admin()
);

DROP POLICY IF EXISTS org_members_insert ON public.organization_members;
CREATE POLICY org_members_insert
ON public.organization_members
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om_admin
    WHERE om_admin.organization_id = organization_members.organization_id
      AND om_admin.user_id = auth.uid()
      AND om_admin.role IN ('owner','admin')
  )
  OR public.is_platform_admin()
);

DROP POLICY IF EXISTS org_members_update ON public.organization_members;
CREATE POLICY org_members_update
ON public.organization_members
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om_admin
    WHERE om_admin.organization_id = organization_members.organization_id
      AND om_admin.user_id = auth.uid()
      AND om_admin.role IN ('owner','admin')
  )
  OR public.is_platform_admin()
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om_admin
    WHERE om_admin.organization_id = organization_members.organization_id
      AND om_admin.user_id = auth.uid()
      AND om_admin.role IN ('owner','admin')
  )
  OR public.is_platform_admin()
);

DROP POLICY IF EXISTS org_members_delete ON public.organization_members;
CREATE POLICY org_members_delete
ON public.organization_members
FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.organization_members om_admin
    WHERE om_admin.organization_id = organization_members.organization_id
      AND om_admin.user_id = auth.uid()
      AND om_admin.role IN ('owner','admin')
  )
  OR public.is_platform_admin()
);

COMMIT;
