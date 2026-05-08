-- Backfill organizations.stripe_account_id/charges_enabled/payouts_enabled from profiles
-- when linked via profiles.primary_organization_id and org fields are missing
BEGIN;

UPDATE public.organizations o
SET 
  stripe_account_id = p.stripe_account_id,
  charges_enabled = COALESCE(o.charges_enabled, p.charges_enabled),
  payouts_enabled = COALESCE(o.payouts_enabled, p.payouts_enabled)
FROM public.profiles p
WHERE p.primary_organization_id = o.id
  AND (
    o.stripe_account_id IS NULL OR length(btrim(coalesce(o.stripe_account_id, ''))) = 0
    OR o.charges_enabled IS NULL
    OR o.payouts_enabled IS NULL
  );

COMMIT;
