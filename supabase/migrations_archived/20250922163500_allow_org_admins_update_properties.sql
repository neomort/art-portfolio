-- Allow organization owners/admins to update properties linked to their organization
-- This complements the existing venue owner update policy.

begin;

-- Ensure RLS is enabled on properties (assumed true in prod)
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

-- Base grant (updates are still constrained by RLS policies)
GRANT UPDATE ON public.properties TO authenticated;
GRANT ALL ON public.properties TO service_role;

-- Create an update policy for org owners/admins
DO $$
BEGIN
  CREATE POLICY properties_update_org_admin
    ON public.properties
    FOR UPDATE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.organization_id = properties.organization_id
          AND om.user_id = auth.uid()
          AND om.role IN ('owner','admin')
      )
      OR properties.venue_id = auth.uid()
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.organization_id = properties.organization_id
          AND om.user_id = auth.uid()
          AND om.role IN ('owner','admin')
      )
      OR properties.venue_id = auth.uid()
    );
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

commit;
