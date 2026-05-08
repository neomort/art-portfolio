/*
  # Add longer-term pricing options to properties table

  1. New Columns
    - `weekly_rate_type` (text) - Type of weekly rate ('fixed' or 'percentage')
    - `weekly_rate_value` (numeric) - Value for weekly rate (fixed amount or percentage discount)
    - `monthly_rate_type` (text) - Type of monthly rate ('fixed' or 'percentage')
    - `monthly_rate_value` (numeric) - Value for monthly rate (fixed amount or percentage discount)
    - `yearly_rate_type` (text) - Type of yearly rate ('fixed' or 'percentage')
    - `yearly_rate_value` (numeric) - Value for yearly rate (fixed amount or percentage discount)
    
  2. Constraints
    - Check constraints to ensure rate types are either 'fixed' or 'percentage'
    
  3. Security
    - No RLS changes needed as existing policies cover the new columns
*/

-- Add weekly rate columns
ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS weekly_rate_type text,
ADD COLUMN IF NOT EXISTS weekly_rate_value numeric;

-- Add monthly rate columns
ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS monthly_rate_type text,
ADD COLUMN IF NOT EXISTS monthly_rate_value numeric;

-- Add yearly rate columns
ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS yearly_rate_type text,
ADD COLUMN IF NOT EXISTS yearly_rate_value numeric;

-- Add check constraints for rate types using DO block to check if they exist first
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'properties_weekly_rate_type_check'
  ) THEN
    ALTER TABLE public.properties
    ADD CONSTRAINT properties_weekly_rate_type_check
    CHECK (weekly_rate_type IS NULL OR weekly_rate_type IN ('fixed', 'percentage'));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'properties_monthly_rate_type_check'
  ) THEN
    ALTER TABLE public.properties
    ADD CONSTRAINT properties_monthly_rate_type_check
    CHECK (monthly_rate_type IS NULL OR monthly_rate_type IN ('fixed', 'percentage'));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'properties_yearly_rate_type_check'
  ) THEN
    ALTER TABLE public.properties
    ADD CONSTRAINT properties_yearly_rate_type_check
    CHECK (yearly_rate_type IS NULL OR yearly_rate_type IN ('fixed', 'percentage'));
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN public.properties.weekly_rate_type IS 'Type of weekly rate (fixed or percentage discount)';
COMMENT ON COLUMN public.properties.weekly_rate_value IS 'Value for weekly rate (fixed amount or percentage discount)';
COMMENT ON COLUMN public.properties.monthly_rate_type IS 'Type of monthly rate (fixed or percentage discount)';
COMMENT ON COLUMN public.properties.monthly_rate_value IS 'Value for monthly rate (fixed amount or percentage discount)';
COMMENT ON COLUMN public.properties.yearly_rate_type IS 'Type of yearly rate (fixed or percentage discount)';
COMMENT ON COLUMN public.properties.yearly_rate_value IS 'Value for yearly rate (fixed amount or percentage discount)';