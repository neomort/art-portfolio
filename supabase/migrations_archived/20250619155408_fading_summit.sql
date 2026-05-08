/*
  # Add about_brand field to profiles table

  1. Changes
    - Add `about_brand` text column to profiles table
    - This field will store information about the user's brand for merchants
    
  2. Security
    - No RLS changes needed as existing policies cover the new column
*/

-- Add about_brand column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS about_brand text;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.about_brand IS 'Information about the user''s brand (for merchants)';