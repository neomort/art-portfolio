/*
  # Fix infinite recursion in profiles RLS policies

  1. Problem
    - The "Admins can view all profiles" policy creates infinite recursion
    - It queries the same profiles table it's trying to protect
    - This causes Supabase to enter an infinite loop when evaluating policies

  2. Solution
    - Remove the problematic admin policies that cause recursion
    - Keep simple, non-recursive policies for basic user access
    - Admin access can be handled at the application level instead of RLS

  3. Changes
    - Drop the recursive admin policies
    - Keep safe policies for user self-access
    - Ensure public profile viewing remains functional
*/

-- Drop all existing policies on profiles table
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Public profiles viewable" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;

-- Create safe, non-recursive policies
CREATE POLICY "Users can view their own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow public read access to basic profile info (needed for property listings, reviews, etc.)
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles
  FOR SELECT
  TO public
  USING (true);