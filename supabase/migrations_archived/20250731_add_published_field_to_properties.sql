-- Add published field to properties table (idempotent)
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT FALSE;

-- Ensure existing properties have a published value; if column pre-exists, this is still safe
UPDATE properties 
SET published = COALESCE(published, TRUE);

-- Add comment to the column
COMMENT ON COLUMN properties.published IS 'Indicates whether the property is published and visible in public listings';

-- Add RLS policies for the new field (idempotent via existence checks)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'properties' AND policyname = 'Users can view published properties'
  ) THEN
    CREATE POLICY "Users can view published properties" ON properties
    FOR SELECT
    USING (published = TRUE OR auth.uid() = venue_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'properties' AND policyname = 'Owners can update published status of their properties'
  ) THEN
    CREATE POLICY "Owners can update published status of their properties" ON properties
    FOR UPDATE TO authenticated
    USING (auth.uid() = venue_id)
    WITH CHECK (auth.uid() = venue_id);
  END IF;
END $$;
