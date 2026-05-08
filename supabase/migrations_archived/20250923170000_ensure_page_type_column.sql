-- Ensure the page_type column exists and has the correct constraints
DO $$
BEGIN
  -- Add the page_type column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'pages' 
    AND column_name = 'page_type'
  ) THEN
    ALTER TABLE pages 
    ADD COLUMN page_type text 
    DEFAULT 'Information' 
    NOT NULL;
    
    RAISE NOTICE 'Added page_type column to pages table';
  ELSE
    -- Ensure the column has the correct default and NOT NULL constraint
    ALTER TABLE pages 
    ALTER COLUMN page_type SET DEFAULT 'Information',
    ALTER COLUMN page_type SET NOT NULL;
    
    RAISE NOTICE 'Updated page_type column constraints';
  END IF;
  
  -- Add or update the check constraint
  IF EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE table_name = 'pages' 
    AND constraint_name = 'valid_page_types'
  ) THEN
    ALTER TABLE pages 
    DROP CONSTRAINT valid_page_types;
  END IF;
  
  ALTER TABLE pages 
  ADD CONSTRAINT valid_page_types 
  CHECK (page_type IN ('Support', 'Legal', 'News', 'Information', 'Landing Page', 'Features'));
  
  RAISE NOTICE 'Added/updated valid_page_types check constraint';
  
  -- Update any existing NULL values to the default
  UPDATE pages 
  SET page_type = 'Information' 
  WHERE page_type IS NULL;
  
  RAISE NOTICE 'Updated any NULL page_type values to default';
  
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error ensuring page_type column: %', SQLERRM;
END $$;
