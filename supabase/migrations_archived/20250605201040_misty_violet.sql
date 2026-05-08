/*
  # Add limit_availability flag to property_schedule

  1. Changes
    - Add a limit_availability boolean column to property_schedule
    - This flag determines if the venue should respect the daily schedule
    - When false, the venue is considered available 24/7
    - Default to true for backward compatibility
  
  2. Security
    - Maintains existing security model with RLS
*/

-- Add limit_availability column if it doesn't exist
ALTER TABLE property_schedule 
ADD COLUMN IF NOT EXISTS limit_availability boolean DEFAULT true;

-- Create an index on the new column for performance
CREATE INDEX IF NOT EXISTS idx_property_schedule_limit_availability
ON property_schedule (property_id, limit_availability);