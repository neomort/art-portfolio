/*
  # Add page types to pages table

  1. New Columns
    - `type` (text, not null, default 'Information')
  
  2. Changes
    - Add CHECK constraint to ensure type is one of the allowed values
  
  3. Security
    - No changes to RLS policies
*/

-- Add type column to pages table with default value
ALTER TABLE public.pages 
ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'Information';

-- Add CHECK constraint to ensure type is one of the allowed values
ALTER TABLE public.pages 
ADD CONSTRAINT pages_type_check 
CHECK (type IN ('Support', 'Legal', 'News', 'Information', 'Landing Page'));