-- Add Features to the page_type enum in the pages table
-- First, check if the column exists and has a constraint
DO $$
BEGIN
  -- Add the page_type column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'pages' AND column_name = 'page_type') THEN
    ALTER TABLE pages ADD COLUMN page_type text 
      DEFAULT 'Information' 
      CONSTRAINT valid_page_types 
      CHECK (page_type IN ('Support', 'Legal', 'News', 'Information', 'Landing Page', 'Features'));
  ELSE
    -- Update the constraint if the column exists
    ALTER TABLE pages 
      DROP CONSTRAINT IF EXISTS valid_page_types,
      ADD CONSTRAINT valid_page_types 
      CHECK (page_type IN ('Support', 'Legal', 'News', 'Information', 'Landing Page', 'Features'));
  END IF;
END $$;
