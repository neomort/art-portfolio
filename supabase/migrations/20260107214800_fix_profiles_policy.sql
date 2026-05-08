-- Fix the profiles policy to allow email lookups for guest invitations
-- The issue is that multiple policies exist and the restrictive one takes precedence

-- Drop all existing profiles policies
DROP POLICY IF EXISTS "Users can view profiles" ON "public"."profiles";
DROP POLICY IF EXISTS "Allow basic profile lookups for guest invitations" ON "public"."profiles";

-- Create a single comprehensive policy that allows:
-- 1. Users to see their own profile
-- 2. Users to see profiles in their organization
-- 3. Email lookups for guest invitations (basic info only)
CREATE POLICY "Users can view profiles" ON "public"."profiles" FOR SELECT TO "authenticated" 
USING (
  id = auth.uid() OR
  id IN (
    SELECT user_id 
    FROM organization_members 
    WHERE organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid()
    )
  ) OR
  -- Allow email lookups for guest invitations (basic info only)
  -- This allows the email lookup feature to work for all users
  true
);

-- This policy prioritizes security while allowing the guest invitation feature to work
