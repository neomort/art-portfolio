-- Ensure authenticated users can manage organization_adjustments in production
-- This migration enables RLS, grants privileges, and adds a member-based policy

begin;

-- Ensure base privileges exist alongside RLS policies
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_adjustments TO authenticated;
GRANT ALL ON public.organization_adjustments TO service_role;

-- Enable RLS on organization_adjustments
ALTER TABLE public.organization_adjustments ENABLE ROW LEVEL SECURITY;

-- Recreate policy to allow members of an organization to manage its adjustments
DROP POLICY IF EXISTS "org_adjustments_manage" ON public.organization_adjustments;
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
