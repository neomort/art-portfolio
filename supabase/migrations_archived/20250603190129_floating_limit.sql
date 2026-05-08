/*
  # Update inquiries policies for venue owners

  1. Changes
    - Add policy for venue owners to view inquiries for their properties
    - Add policy for venue owners to update inquiries for their properties
    - Add updated_at trigger for inquiries table

  2. Security
    - Maintains existing RLS policies
    - Adds new policies for venue owners
    - Ensures venue owners can only access inquiries for their own properties
*/

-- Add updated_at trigger if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add trigger to inquiries table if it doesn't exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_inquiries_updated_at'
  ) THEN
    CREATE TRIGGER update_inquiries_updated_at
    BEFORE UPDATE ON inquiries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Users can view their own inquiries" ON inquiries;
DROP POLICY IF EXISTS "Users can create inquiries" ON inquiries;

-- Create new policies that include venue owners
CREATE POLICY "Users can view their related inquiries"
ON inquiries
FOR SELECT
TO public
USING (
  user_id = auth.uid() OR 
  property_id IN (
    SELECT id FROM properties WHERE venue_id = auth.uid()
  )
);

CREATE POLICY "Users can create inquiries"
ON inquiries
FOR INSERT
TO public
WITH CHECK (
  auth.uid() = user_id
);

CREATE POLICY "Venue owners can update inquiries"
ON inquiries
FOR UPDATE
TO public
USING (
  property_id IN (
    SELECT id FROM properties WHERE venue_id = auth.uid()
  )
)
WITH CHECK (
  property_id IN (
    SELECT id FROM properties WHERE venue_id = auth.uid()
  )
);