-- Drop existing SELECT policy if it exists
DROP POLICY IF EXISTS "Allow users to view their own inquiries or inquiries for their" ON inquiries;
DROP POLICY IF EXISTS "Allow users to view their own inquiries or inquiries for their properties" ON inquiries;

-- Create a properly named and structured SELECT policy
CREATE POLICY "Users can view their own inquiries and inquiries for their properties"
  ON inquiries
  FOR SELECT
  TO authenticated
  USING (
    -- User is the inquiry creator
    auth.uid() = user_id 
    OR 
    -- User owns the property that the inquiry is for
    auth.uid() IN (
      SELECT properties.venue_id
      FROM properties
      WHERE properties.id = inquiries.property_id
    )
  );

-- Ensure the policy is enabled
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;