-- Add Stripe linkage at the organization level
-- Idempotent: add columns if they do not exist

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'stripe_account_id'
  ) THEN
    ALTER TABLE public.organizations ADD COLUMN stripe_account_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'charges_enabled'
  ) THEN
    ALTER TABLE public.organizations ADD COLUMN charges_enabled boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'payouts_enabled'
  ) THEN
    ALTER TABLE public.organizations ADD COLUMN payouts_enabled boolean DEFAULT false;
  END IF;
END $$;

COMMIT;
