-- Consolidated organization permissions and RLS policies
-- This migration sets up proper permissions for organization management

begin;

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON public.organizations TO authenticated;
GRANT SELECT, INSERT ON public.organization_members TO authenticated;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;

-- Grant full permissions to service role for admin operations
GRANT ALL ON public.organizations TO service_role;
GRANT ALL ON public.organization_members TO service_role;
GRANT ALL ON public.organization_adjustments TO service_role;

-- Enable RLS on organizations table
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies to avoid conflicts
DROP POLICY IF EXISTS "organizations_update_about_brand_any_member" ON public.organizations;
DROP POLICY IF EXISTS "org_adjustments_manage_any_member" ON public.organization_adjustments;

-- Allow authenticated users to create organizations
CREATE POLICY "allow_organization_creation"
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Allow users to update organizations they're members of
CREATE POLICY "allow_organization_updates"
ON public.organizations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = organizations.id
    AND om.user_id = auth.uid()
  )
);

-- Allow users to read organizations they're members of
CREATE POLICY "allow_organization_select"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = organizations.id
    AND om.user_id = auth.uid()
  )
);

-- Allow organization members to update the about_brand field
CREATE POLICY "organizations_update_about_brand"
ON public.organizations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = organizations.id
    AND om.user_id = auth.uid()
  )
);

-- Allow organization members to manage adjustments
CREATE POLICY "org_adjustments_manage"
ON public.organization_adjustments
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = organization_adjustments.organization_id
    AND om.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = organization_adjustments.organization_id
    AND om.user_id = auth.uid()
  )
);

commit;
