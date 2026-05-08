/*
  # Add tax and fee fields to properties

  1. Changes
    - Add tax_rate (numeric) to properties table
    - Add fee_type (text) to properties table with values 'percentage' or 'fixed'
    - Add fee_value (numeric) to properties table
    
  2. Notes
    - tax_rate represents a percentage (e.g., 8.5 means 8.5%)
    - fee_type determines how fee_value is interpreted
    - When fee_type is 'percentage', fee_value is a percentage of base price
    - When fee_type is 'fixed', fee_value is a flat amount in currency units
*/

-- Add tax_rate column if it doesn't exist
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS tax_rate numeric DEFAULT 0;

-- Add fee_type column if it doesn't exist
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS fee_type text DEFAULT 'percentage';

-- Add check constraint for fee_type values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'properties_fee_type_check'
  ) THEN
    ALTER TABLE public.properties
    ADD CONSTRAINT properties_fee_type_check 
    CHECK (fee_type IN ('percentage', 'fixed'));
  END IF;
END$$;

-- Add fee_value column if it doesn't exist
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS fee_value numeric DEFAULT 0;

-- Comment on new columns
COMMENT ON COLUMN public.properties.tax_rate IS 'Tax rate percentage (e.g., 8.5 for 8.5%)';
COMMENT ON COLUMN public.properties.fee_type IS 'Type of fee: percentage or fixed';
COMMENT ON COLUMN public.properties.fee_value IS 'Value for fee, either percentage or fixed amount';