-- Allow all organization members (owner, admin, member) to update properties
-- This extends permissions beyond owners/admins.

begin;

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

GRANT UPDATE ON public.properties TO authenticated;
GRANT ALL ON public.properties TO service_role;

-- Drop narrower policy if it exists to avoid overlap/confusion
DROP POLICY IF EXISTS properties_update_org_admin ON public.properties;

DO $$
BEGIN
  CREATE POLICY properties_update_org_members
    ON public.properties
    FOR UPDATE
    TO authenticated
    USING (
      -- Venue owner can always update
      properties.venue_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.organization_id = properties.organization_id
          AND om.user_id = auth.uid()
          AND om.role IN ('owner','admin','member')
      )
    )
    WITH CHECK (
      properties.venue_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.organization_id = properties.organization_id
          AND om.user_id = auth.uid()
          AND om.role IN ('owner','admin','member')
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

commit;
