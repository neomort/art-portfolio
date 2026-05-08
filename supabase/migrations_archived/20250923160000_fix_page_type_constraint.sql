-- Fix page_type constraint and ensure it has a default value
DO $$
BEGIN
  -- First, drop the constraint if it exists
  IF EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE table_name = 'pages' 
    AND constraint_name = 'valid_page_types'
  ) THEN
    ALTER TABLE pages DROP CONSTRAINT valid_page_types;
  END IF;
  
  -- Then add or update the column with the correct default and constraint
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'pages' 
    AND column_name = 'page_type'
  ) THEN
    -- Add the column if it doesn't exist
    ALTER TABLE pages 
    ADD COLUMN page_type text 
    DEFAULT 'Information' 
    NOT NULL;
  ELSE
    -- Update the column to ensure it has a default value and is not null
    ALTER TABLE pages 
    ALTER COLUMN page_type SET DEFAULT 'Information',
    ALTER COLUMN page_type SET NOT NULL;
  END IF;
  
  -- Add the constraint
  ALTER TABLE pages 
  ADD CONSTRAINT valid_page_types 
  CHECK (page_type IN ('Support', 'Legal', 'News', 'Information', 'Landing Page', 'Features'));
  
  -- Update any existing NULL values to the default
  UPDATE pages SET page_type = 'Information' WHERE page_type IS NULL;
  
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error fixing page_type constraint: %', SQLERRM;
    -- If there's an error, at least ensure the column has a default value
    BEGIN
      ALTER TABLE pages 
      ALTER COLUMN page_type SET DEFAULT 'Information';
    EXCEPTION WHEN OTHERS THEN
      -- If this also fails, just log it
      RAISE NOTICE 'Could not set default value: %', SQLERRM;
    END;
END $$;
