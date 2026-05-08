-- Enable RLS on organization_members and add sensible policies
BEGIN;

-- Enable RLS (idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema='public' AND table_name='organization_members'
  ) THEN
    EXECUTE 'ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- SELECT policy: a user can read rows where they are a member; org owners/admins of the org can read; platform admins can read
DROP POLICY IF EXISTS org_members_select ON public.organization_members;
CREATE POLICY org_members_select
ON public.organization_members
FOR SELECT TO authenticated
USING (
  -- self can read their memberships
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.organization_members om_admin
    WHERE om_admin.organization_id = organization_members.organization_id
      AND om_admin.user_id = auth.uid()
      AND om_admin.role IN ('owner','admin')
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_admin = true
  )
);

-- INSERT policy: only org owners/admins (in target org) or platform admins can add
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
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_admin = true
  )
);

-- UPDATE policy: only org owners/admins or platform admins can update roles
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
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om_admin
    WHERE om_admin.organization_id = organization_members.organization_id
      AND om_admin.user_id = auth.uid()
      AND om_admin.role IN ('owner','admin')
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_admin = true
  )
);

-- DELETE policy: member can remove own membership; org owners/admins and platform admins can remove any member
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
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_admin = true
  )
);

COMMIT;
