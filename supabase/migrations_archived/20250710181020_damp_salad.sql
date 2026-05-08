/*
  # Add longer-term pricing columns to properties table

  1. New Columns
    - `weekly_rate_type` (text, nullable) - Type of weekly rate: 'fixed' or 'percentage'
    - `weekly_rate_value` (numeric, nullable) - Value for weekly rate
    - `monthly_rate_type` (text, nullable) - Type of monthly rate: 'fixed' or 'percentage'  
    - `monthly_rate_value` (numeric, nullable) - Value for monthly rate
    - `yearly_rate_type` (text, nullable) - Type of yearly rate: 'fixed' or 'percentage'
    - `yearly_rate_value` (numeric, nullable) - Value for yearly rate

  2. Constraints
    - Add check constraints to ensure rate types are either 'fixed' or 'percentage'
*/

-- Add weekly rate columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'weekly_rate_type'
  ) THEN
    ALTER TABLE properties ADD COLUMN weekly_rate_type text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'weekly_rate_value'
  ) THEN
    ALTER TABLE properties ADD COLUMN weekly_rate_value numeric;
  END IF;
END $$;

-- Add monthly rate columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'monthly_rate_type'
  ) THEN
    ALTER TABLE properties ADD COLUMN monthly_rate_type text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'monthly_rate_value'
  ) THEN
    ALTER TABLE properties ADD COLUMN monthly_rate_value numeric;
  END IF;
END $$;

-- Add yearly rate columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'yearly_rate_type'
  ) THEN
    ALTER TABLE properties ADD COLUMN yearly_rate_type text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'yearly_rate_value'
  ) THEN
    ALTER TABLE properties ADD COLUMN yearly_rate_value numeric;
  END IF;
END $$;

-- Add check constraints for rate types
ALTER TABLE properties 
DROP CONSTRAINT IF EXISTS properties_weekly_rate_type_check;

ALTER TABLE properties 
ADD CONSTRAINT properties_weekly_rate_type_check 
CHECK (weekly_rate_type IS NULL OR weekly_rate_type = ANY (ARRAY['fixed'::text, 'percentage'::text]));

ALTER TABLE properties 
DROP CONSTRAINT IF EXISTS properties_monthly_rate_type_check;

ALTER TABLE properties 
ADD CONSTRAINT properties_monthly_rate_type_check 
CHECK (monthly_rate_type IS NULL OR monthly_rate_type = ANY (ARRAY['fixed'::text, 'percentage'::text]));

ALTER TABLE properties 
DROP CONSTRAINT IF EXISTS properties_yearly_rate_type_check;

ALTER TABLE properties 
ADD CONSTRAINT properties_yearly_rate_type_check 
CHECK (yearly_rate_type IS NULL OR yearly_rate_type = ANY (ARRAY['fixed'::text, 'percentage'::text]));