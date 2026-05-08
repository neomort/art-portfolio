-- Fix infinite recursion in organization_members RLS policy
-- The current policy references organization_members within itself, causing infinite recursion

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can manage their organization membership" ON "public"."organization_members";

-- Create a new, non-recursive policy that allows users to:
-- 1. Manage their own membership records
-- 2. Manage organization memberships if they are admin/owner of that organization
CREATE POLICY "Users can manage their organization membership" ON "public"."organization_members" TO "authenticated" 
USING (
  -- Users can manage their own membership records
  (user_id = auth.uid()) 
  OR 
  -- Admins and owners can manage all memberships in their organization
  (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'owner')
    )
    AND role <> 'owner'  -- Only owners can modify owner roles
  )
) 
WITH CHECK (
  -- Users can create their own membership records
  (user_id = auth.uid()) 
  OR 
  -- Admins and owners can create membership records in their organization
  (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'owner')
    )
    AND role <> 'owner'  -- Only owners can create owner roles
  )
);

-- Also need to fix the organizations policy that references organization_members
DROP POLICY IF EXISTS "Users can view organizations" ON "public"."organizations";

-- Create a new organizations policy that avoids recursion
CREATE POLICY "Users can view organizations" ON "public"."organizations" FOR SELECT TO "authenticated" 
USING (
  id IN (
    SELECT DISTINCT organization_id 
    FROM organization_members 
    WHERE user_id = auth.uid()
  )
);
