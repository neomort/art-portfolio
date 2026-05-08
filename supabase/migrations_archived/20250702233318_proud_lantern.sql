/*
  # Add admin policies to profiles table

  1. Changes
    - Drop existing policies on profiles table
    - Recreate policies with admin functionality
    - Add new policies for admins to view and update any profile
    
  2. Security
    - Maintain existing security model
    - Add special privileges for admin users
*/

-- Revoke existing policies on profiles table to ensure clean re-creation
DROP POLICY IF EXISTS "Allow viewing profiles for inquiry participants" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Re-create policies with admin logic

-- SELECT policies
-- Policy: Public profiles are viewable by everyone
CREATE POLICY "Public profiles are viewable by everyone"
ON public.profiles
FOR SELECT
USING (true);

-- Policy: Allow viewing profiles for inquiry participants
CREATE POLICY "Allow viewing profiles for inquiry participants"
ON public.profiles
FOR SELECT
USING (
  (auth.uid() = id) OR
  (id IN ( SELECT DISTINCT inquiries.user_id
           FROM inquiries
           WHERE ((inquiries.user_id = auth.uid()) OR (inquiries.property_id IN ( SELECT properties.id
                                                                               FROM properties
                                                                               WHERE (properties.venue_id = auth.uid())))))
  ) OR
  (id IN ( SELECT DISTINCT properties.venue_id
           FROM (properties
                 JOIN inquiries ON ((inquiries.property_id = properties.id)))
           WHERE (inquiries.user_id = auth.uid())))
);

-- New Policy: Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (EXISTS ( SELECT 1
                FROM public.profiles
                WHERE (profiles.id = auth.uid() AND profiles.is_admin = true)));

-- INSERT policy
-- Policy: Users can insert their own profile
CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- UPDATE policies
-- Policy: Users can update their own profile (excluding is_admin)
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- New Policy: Admins can update any profile
CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
USING (EXISTS ( SELECT 1
                FROM public.profiles
                WHERE (profiles.id = auth.uid() AND profiles.is_admin = true)));