/*
  # Fix infinite recursion in profiles RLS policies

  1. Problem
    - Current RLS policies on profiles table are causing infinite recursion
    - The `uid()` function calls are likely creating circular references
    - This prevents users from accessing their profile data

  2. Solution
    - Drop existing problematic policies
    - Create new, simplified policies that avoid recursion
    - Use `auth.uid()` instead of `uid()` for better clarity
    - Ensure policies don't reference the profiles table in their conditions

  3. New Policies
    - Public read access for basic profile viewing
    - Authenticated users can insert their own profile
    - Authenticated users can update their own profile
    - Authenticated users can view their own profile details
*/

-- Drop existing policies that are causing recursion
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;

-- Create new, non-recursive policies
CREATE POLICY "Enable read access for all users" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users based on user_id" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Enable update for users based on user_id" ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Enable delete for users based on user_id" ON profiles
  FOR DELETE USING (auth.uid() = id);