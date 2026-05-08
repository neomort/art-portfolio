/*
  # Add is_admin column to profiles table

  1. Changes
    - Add `is_admin` column to `profiles` table
    - Set default value to `false`
    - Make column non-nullable with default

  2. Security
    - No changes to existing RLS policies needed
    - Column will be accessible through existing policies
*/

-- Add is_admin column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false NOT NULL;

-- Add comment to document the column
COMMENT ON COLUMN profiles.is_admin IS 'Indicates if the user has administrative privileges';