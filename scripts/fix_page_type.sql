-- Check if the page_type column exists
SELECT EXISTS (
  SELECT 1 
  FROM information_schema.columns 
  WHERE table_name = 'pages' 
  AND column_name = 'page_type'
) AS column_exists;
