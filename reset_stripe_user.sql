-- Reset Stripe settings for user fe543d69-f2dc-4097-8b3e-daa379fd3876
-- This will allow them to start fresh with Stripe onboarding

-- First, get the user's primary organization
SELECT id, name, stripe_account_id, charges_enabled, payouts_enabled 
FROM organizations 
WHERE id = (SELECT primary_organization_id FROM profiles WHERE id = 'fe543d69-f2dc-4097-8b3e-daa379fd3876');

-- Then reset the Stripe fields
UPDATE organizations 
SET 
  stripe_account_id = NULL,
  charges_enabled = false,
  payouts_enabled = false,
  updated_at = NOW()
WHERE id = (SELECT primary_organization_id FROM profiles WHERE id = 'fe543d69-f2dc-4097-8b3e-daa379fd3876');

-- Verify the reset
SELECT id, name, stripe_account_id, charges_enabled, payouts_enabled 
FROM organizations 
WHERE id = (SELECT primary_organization_id FROM profiles WHERE id = 'fe543d69-f2dc-4097-8b3e-daa379fd3876');
