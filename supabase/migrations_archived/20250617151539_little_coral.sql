/*
  # Fix RLS policies for inquiry archive functionality

  1. Changes
    - Drop existing update policies for inquiries
    - Create new policies that allow both inquiry creators and property owners to update inquiries
    - Simplify the policy logic to avoid OLD/NEW references which aren't available in RLS
    
  2. Security
    - Maintain proper access control
    - Allow inquiry creators to update their own inquiries
    - Allow property owners to update inquiries for their properties
*/

-- Drop existing update policies for inquiries to avoid conflicts
DROP POLICY IF EXISTS "Property owners can update inquiries for their properties" ON inquiries;
DROP POLICY IF EXISTS "Allow property owners to update inquiries" ON inquiries;
DROP POLICY IF EXISTS "Users can update their own inquiry fields" ON inquiries;

-- Create a simpler update policy that allows appropriate users to update inquiries
CREATE POLICY "Allow inquiry and property owner updates"
  ON inquiries
  FOR UPDATE
  TO authenticated
  USING (
    -- User is either the inquiry creator OR the property owner
    (auth.uid() = user_id) OR
    (auth.uid() IN (
      SELECT properties.venue_id
      FROM properties
      WHERE properties.id = inquiries.property_id
    ))
  )
  WITH CHECK (
    -- Same users can update as can view/edit
    (auth.uid() = user_id) OR
    (auth.uid() IN (
      SELECT properties.venue_id
      FROM properties
      WHERE properties.id = inquiries.property_id
    ))
  );

-- Ensure RLS is enabled on inquiries table
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;