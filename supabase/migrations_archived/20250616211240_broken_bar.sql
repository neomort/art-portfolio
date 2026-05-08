/*
  # Fix venue owner booking policy

  1. Changes
    - Drop existing policy if it exists
    - Recreate the policy to allow venue owners to create bookings for their properties
  
  2. Security
    - Ensures venue owners can create bookings for properties they own
    - Maintains proper access control
*/

-- Drop the policy if it exists to avoid conflicts
DROP POLICY IF EXISTS "Venue owners can create bookings for their properties" ON bookings;

-- Add policy to allow venue owners to create bookings for their properties
CREATE POLICY "Venue owners can create bookings for their properties"
  ON bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IN (
      SELECT venue_id 
      FROM properties 
      WHERE id = property_id
    )
  );