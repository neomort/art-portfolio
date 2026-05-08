/*
  # Add is_admin column to profiles table

  1. New Columns
    - `is_admin` (boolean) - Indicates if the user has administrative privileges
  2. Security
    - No changes to RLS policies
*/

-- Add is_admin column to profiles table if it doesn't exist
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false NOT NULL;

-- Add comment to document the column
COMMENT ON COLUMN profiles.is_admin IS 'Indicates if the user has administrative privileges';