-- +goose Up
-- Add virtual_tour_url (text) and downloadable_files (jsonb) to properties table
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS virtual_tour_url text,
  ADD COLUMN IF NOT EXISTS downloadable_files jsonb;

-- Create a simple check to ensure downloadable_files, if set, is an array of objects
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'properties_downloadable_files_is_array'
      AND conrelid = 'public.properties'::regclass
  ) THEN
    ALTER TABLE public.properties
      ADD CONSTRAINT properties_downloadable_files_is_array
      CHECK (
        downloadable_files IS NULL OR jsonb_typeof(downloadable_files) = 'array'
      );
  END IF;
END $$;

-- +goose Down
ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_downloadable_files_is_array,
  DROP COLUMN IF EXISTS downloadable_files,
  DROP COLUMN IF EXISTS virtual_tour_url;
