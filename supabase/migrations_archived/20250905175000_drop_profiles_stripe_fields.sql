-- Drop profile-level Stripe fields now that Stripe linkage is organization-scoped
BEGIN;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS stripe_account_id,
  DROP COLUMN IF EXISTS charges_enabled,
  DROP COLUMN IF EXISTS payouts_enabled;

COMMIT;
