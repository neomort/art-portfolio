-- Add Stripe-related fields to bookings table
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
ADD COLUMN IF NOT EXISTS stripe_client_secret text;

-- Add indexes for Stripe fields
CREATE INDEX IF NOT EXISTS idx_bookings_payment_intent ON public.bookings(stripe_payment_intent_id);

-- Add constraint to ensure payment intent ID is unique
ALTER TABLE public.bookings
ADD CONSTRAINT unique_payment_intent UNIQUE (stripe_payment_intent_id);