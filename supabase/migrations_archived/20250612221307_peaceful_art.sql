/*
  # Add featured column to properties table

  1. New Column
    - Add `featured` boolean column to `properties` table with default value FALSE
    - Add index for better query performance on featured properties
  
  2. Security
    - No RLS changes needed as existing policies cover the new column
*/

-- Add featured column to properties table
ALTER TABLE properties ADD COLUMN IF NOT EXISTS featured boolean DEFAULT false;

-- Add index for better performance when querying featured properties
CREATE INDEX IF NOT EXISTS idx_properties_featured ON properties(featured) WHERE featured = true;

-- Add comment for documentation
COMMENT ON COLUMN properties.featured IS 'Indicates if this property should be displayed in the featured section';