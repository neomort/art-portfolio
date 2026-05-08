/*
  # Fix RLS policies for inquiries table

  1. Policy Updates
    - Drop existing SELECT policy that may have issues
    - Create a new, clearer SELECT policy for inquiries
    - Clean up any duplicate INSERT policies
    - Ensure proper access for inquiry creators and property owners

  2. Security
    - Allow users to view inquiries they created
    - Allow property owners to view inquiries for their properties
    - Maintain security by preventing unauthorized access
*/

-- Drop existing policies to start fresh
DROP POLICY IF EXISTS "Users can view their related inquiries" ON inquiries;
DROP POLICY IF EXISTS "Authenticated users can create inquiries" ON inquiries;
DROP POLICY IF EXISTS "Users can create inquiries" ON inquiries;
DROP POLICY IF EXISTS "Venue owners can update inquiries" ON inquiries;

-- Create new SELECT policy with clear logic
CREATE POLICY "Allow read access for inquiry creator or property owner"
  ON inquiries
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR 
    auth.uid() IN (
      SELECT venue_id 
      FROM properties 
      WHERE id = property_id
    )
  );

-- Create INSERT policy for authenticated users
CREATE POLICY "Allow inquiry creation by authenticated users"
  ON inquiries
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create UPDATE policy for property owners
CREATE POLICY "Allow property owners to update inquiries"
  ON inquiries
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT venue_id 
      FROM properties 
      WHERE id = property_id
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT venue_id 
      FROM properties 
      WHERE id = property_id
    )
  );

-- Create DELETE policy for inquiry creators and property owners
CREATE POLICY "Allow deletion by inquiry creator or property owner"
  ON inquiries
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id OR 
    auth.uid() IN (
      SELECT venue_id 
      FROM properties 
      WHERE id = property_id
    )
  );