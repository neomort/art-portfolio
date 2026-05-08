-- Complete fix for infinite recursion in RLS policies
-- This migration drops all problematic policies and creates non-recursive versions

-- First, drop all problematic policies that cause recursion
DROP POLICY IF EXISTS "Users can manage their organization membership" ON "public"."organization_members";
DROP POLICY IF EXISTS "Users can view organizations" ON "public"."organizations";
DROP POLICY IF EXISTS "Organization admins can manage organizations" ON "public"."organizations";
DROP POLICY IF EXISTS "Users can update their own profile" ON "public"."profiles";
DROP POLICY IF EXISTS "Users can view profiles" ON "public"."profiles";

-- Create a simple, non-recursive policy for organization_members
CREATE POLICY "Users can manage their organization membership" ON "public"."organization_members" TO "authenticated" 
USING (
  -- Users can view their own memberships
  user_id = auth.uid()
) 
WITH CHECK (
  -- Users can insert their own memberships
  user_id = auth.uid()
);

-- Create a simple policy for organizations
CREATE POLICY "Users can view organizations" ON "public"."organizations" FOR SELECT TO "authenticated" 
USING (
  id IN (
    SELECT organization_id 
    FROM organization_members 
    WHERE user_id = auth.uid()
  )
);

-- Create a simple policy for profiles
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
  )
);

CREATE POLICY "Users can update their own profile" ON "public"."profiles" TO "authenticated" 
USING (
  id = auth.uid()
) 
WITH CHECK (
  id = auth.uid()
);

-- RLS must be enabled for these tables
ALTER TABLE "public"."organization_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;
