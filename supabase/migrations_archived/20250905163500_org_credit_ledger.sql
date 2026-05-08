-- Organization service credit ledger and atomic apply function
BEGIN;

-- 1) Ledger table (idempotent)
CREATE TABLE IF NOT EXISTS public.organization_credit_ledger (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  payment_intent_id text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  reason text NOT NULL DEFAULT 'service_credit_applied',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id, payment_intent_id)
);

-- 2) Atomic apply function: inserts ledger row; if inserted, decrements org credit
CREATE OR REPLACE FUNCTION public.apply_org_service_credit(
  p_booking_id uuid,
  p_payment_intent_id text,
  p_org_id uuid,
  p_amount_cents integer,
  p_reason text DEFAULT 'service_credit_applied'
) RETURNS boolean AS $$
DECLARE
  inserted boolean := false;
  affected_rows integer := 0;
BEGIN
  -- Insert ledger entry if not exists
  INSERT INTO public.organization_credit_ledger (organization_id, booking_id, payment_intent_id, amount_cents, reason)
  VALUES (p_org_id, p_booking_id, p_payment_intent_id, p_amount_cents, COALESCE(p_reason, 'service_credit_applied'))
  ON CONFLICT (booking_id, payment_intent_id) DO NOTHING;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  inserted := affected_rows > 0;

  IF inserted THEN
    -- Decrement org credit in dollars, never below zero
    UPDATE public.organizations
    SET service_credit = GREATEST(0, COALESCE(service_credit, 0) - (p_amount_cents / 100.0)),
        updated_at = now()
    WHERE id = p_org_id;
  END IF;

  RETURN inserted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.apply_org_service_credit(uuid, text, uuid, integer, text) IS 'Atomically records a service credit application and decrements organization.service_credit; idempotent per (booking_id, payment_intent_id).';

COMMIT;
