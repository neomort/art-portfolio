/*
  # Add Stripe columns to profiles table

  1. New Columns
    - `stripe_account_id` (text, nullable) - Stripe Connect Account ID for the user
    - `charges_enabled` (boolean, default false) - Whether the Stripe account can create live charges  
    - `payouts_enabled` (boolean, default false) - Whether Stripe can send payouts to this account

  2. Security
    - No RLS changes needed as these columns are part of existing profiles table
*/

-- Add Stripe-related columns to profiles table
DO $$
BEGIN
  -- Add stripe_account_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'stripe_account_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN stripe_account_id text;
    COMMENT ON COLUMN profiles.stripe_account_id IS 'Stripe Connect Account ID for the user';
  END IF;

  -- Add charges_enabled column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'charges_enabled'
  ) THEN
    ALTER TABLE profiles ADD COLUMN charges_enabled boolean DEFAULT false;
    COMMENT ON COLUMN profiles.charges_enabled IS 'Whether the Stripe account can create live charges';
  END IF;

  -- Add payouts_enabled column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'payouts_enabled'
  ) THEN
    ALTER TABLE profiles ADD COLUMN payouts_enabled boolean DEFAULT false;
    COMMENT ON COLUMN profiles.payouts_enabled IS 'Whether Stripe can send payouts to this account';
  END IF;
END $$;