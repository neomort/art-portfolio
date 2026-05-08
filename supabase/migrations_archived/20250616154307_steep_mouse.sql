/*
  # Add venue owner booking policy

  1. Changes
    - Add policy to allow venue owners to create bookings for their properties
    - Venue owners can create bookings where they own the property
    
  2. Security
    - Maintains existing RLS policies
    - Allows venue owners to create bookings for inquiries on their properties
*/

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