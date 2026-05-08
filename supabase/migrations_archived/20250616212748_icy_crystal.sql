-- Drop ALL existing policies for inquiries table to ensure clean slate
DROP POLICY IF EXISTS "Allow read access for inquiry creator or property owner" ON inquiries;
DROP POLICY IF EXISTS "Allow inquiry creation by authenticated users" ON inquiries;
DROP POLICY IF EXISTS "Allow property owners to update inquiries" ON inquiries;
DROP POLICY IF EXISTS "Allow deletion by inquiry creator or property owner" ON inquiries;
DROP POLICY IF EXISTS "Allow users to view their own inquiries or inquiries for their properties" ON inquiries;
DROP POLICY IF EXISTS "Authenticated users can create inquiries" ON inquiries;
DROP POLICY IF EXISTS "Property owners can update inquiries for their properties" ON inquiries;
DROP POLICY IF EXISTS "Allow inquiry creators and property owners to delete inquiries" ON inquiries;
DROP POLICY IF EXISTS "Users can view their own inquiries and inquiries for their prop" ON inquiries;
DROP POLICY IF EXISTS "Users can view their own inquiries and inquiries for their properties" ON inquiries;

-- Recreate SELECT policy with better authentication handling
CREATE POLICY "Allow users to view their own inquiries or inquiries for their properties"
  ON inquiries
  FOR SELECT
  TO authenticated
  USING (
    -- User is the inquiry creator
    auth.uid() = user_id
    OR 
    -- User owns the property associated with the inquiry
    auth.uid() IN (
      SELECT properties.venue_id
      FROM properties
      WHERE properties.id = inquiries.property_id
    )
  );

-- Recreate INSERT policy
CREATE POLICY "Authenticated users can create inquiries"
  ON inquiries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND 
    auth.uid() IS NOT NULL
  );

-- Recreate UPDATE policy - only property owners can update inquiries
CREATE POLICY "Property owners can update inquiries for their properties"
  ON inquiries
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT properties.venue_id
      FROM properties
      WHERE properties.id = inquiries.property_id
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT properties.venue_id
      FROM properties
      WHERE properties.id = inquiries.property_id
    )
  );

-- Recreate DELETE policy
CREATE POLICY "Allow inquiry creators and property owners to delete inquiries"
  ON inquiries
  FOR DELETE
  TO authenticated
  USING (
    -- User is the inquiry creator
    auth.uid() = user_id
    OR 
    -- User owns the property associated with the inquiry
    auth.uid() IN (
      SELECT properties.venue_id
      FROM properties
      WHERE properties.id = inquiries.property_id
    )
  );

-- Ensure RLS is enabled on the inquiries table
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

-- Drop existing profile policy if it exists
DROP POLICY IF EXISTS "Allow viewing profiles for inquiry participants" ON profiles;

-- Create a policy to allow users to view profiles that are referenced in inquiries they can access
CREATE POLICY "Allow viewing profiles for inquiry participants"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- User can view their own profile
    auth.uid() = id
    OR
    -- User can view profiles of people in inquiries they're involved with
    id IN (
      SELECT DISTINCT user_id
      FROM inquiries
      WHERE inquiries.user_id = auth.uid()
      OR inquiries.property_id IN (
        SELECT properties.id
        FROM properties
        WHERE properties.venue_id = auth.uid()
      )
    )
    OR
    -- User can view profiles of property owners for inquiries they created
    id IN (
      SELECT DISTINCT properties.venue_id
      FROM properties
      JOIN inquiries ON inquiries.property_id = properties.id
      WHERE inquiries.user_id = auth.uid()
    )
  );