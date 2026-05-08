/*
  # Fix infinite recursion in profiles RLS policies

  1. Changes
    - Drops problematic policy causing infinite recursion
    - Recreates policies using correct auth.uid() function instead of uid()
    - Simplifies access control to avoid circular references
    - Maintains security while allowing necessary profile access

  2. Security
    - Ensures users can only modify their own profiles
    - Allows authenticated users to view profiles (needed for inquiry system)
*/

-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Allow viewing profiles for inquiry participants" ON profiles;

-- Ensure we have the basic policies we need
-- Users can view their own profile
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Users can update their own profile  
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users can insert their own profile
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Keep admin policies as they are
-- (These should already exist and work correctly)

-- Add a simple policy for viewing other profiles when needed
-- This replaces the complex inquiry-based policy with a simpler approach
DROP POLICY IF EXISTS "Public profiles viewable" ON profiles;
CREATE POLICY "Public profiles viewable"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Note: This allows authenticated users to view all profiles
-- If you need more restrictive access, you can modify this policy
-- or handle access control at the application level