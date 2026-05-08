/*
  # Add Stripe Connect fields to profiles table

  1. New Columns
    - `stripe_account_id` (text, nullable) - Stripe Connect Account ID for the user
    - `charges_enabled` (boolean, default false) - Whether the Stripe account can create live charges
    - `payouts_enabled` (boolean, default false) - Whether Stripe can send payouts to this account

  2. Security
    - No RLS changes needed as existing policies cover the new columns
*/

-- Add Stripe Connect fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS stripe_account_id text,
ADD COLUMN IF NOT EXISTS charges_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS payouts_enabled boolean DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.stripe_account_id IS 'Stripe Connect Account ID for the user';
COMMENT ON COLUMN public.profiles.charges_enabled IS 'Whether the Stripe account can create live charges';
COMMENT ON COLUMN public.profiles.payouts_enabled IS 'Whether Stripe can send payouts to this account';