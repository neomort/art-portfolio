/*
  # Fix ambiguous column reference in update_inquiry_on_payment trigger

  1. Changes
    - Drops and recreates the update_inquiry_on_payment trigger function
    - Adds explicit table aliases to resolve the ambiguous inquiry_id reference
    - Improves error handling in the function
  
  2. Background
    - The current trigger function has an ambiguous column reference
    - This causes booking status updates to fail when payments are processed
*/

-- Drop the existing trigger first
DROP TRIGGER IF EXISTS update_inquiry_on_payment ON public.bookings;

-- Drop the existing function
DROP FUNCTION IF EXISTS public.update_inquiry_status_on_payment();

-- Create the improved function with explicit table references
CREATE OR REPLACE FUNCTION public.update_inquiry_status_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if payment_status changed to 'paid'
  IF NEW.payment_status = 'paid' AND OLD.payment_status != 'paid' THEN
    -- Find the proposal associated with this booking
    IF NEW.proposal_id IS NOT NULL THEN
      -- Find the inquiry_id using explicit table aliases
      UPDATE public.inquiries i
      SET 
        status = 'payment_completed',
        updated_at = NOW()
      FROM public.proposals p
      WHERE 
        p.id = NEW.proposal_id AND
        i.id = p.inquiry_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER update_inquiry_on_payment
AFTER UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.update_inquiry_status_on_payment();

-- Add a comment to the trigger for documentation
COMMENT ON TRIGGER update_inquiry_on_payment ON public.bookings IS 'Updates inquiry status to payment_completed when booking payment_status changes to paid';