/*
  # Fix Payment Status Discrepancy

  1. New Functions
    - `update_inquiry_status_on_payment` - Trigger function to update inquiry status when a booking payment is completed
  
  2. Triggers
    - Add trigger on bookings table to update related inquiry status when payment_status changes to 'paid'
  
  3. Changes
    - Ensures inquiries are automatically marked as 'payment_completed' when their associated booking is paid
*/

-- Create a function to update inquiry status when a booking payment is completed
CREATE OR REPLACE FUNCTION update_inquiry_status_on_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  inquiry_id uuid;
BEGIN
  -- Only proceed if payment_status changed to 'paid'
  IF (NEW.payment_status = 'paid' AND (OLD.payment_status IS NULL OR OLD.payment_status != 'paid')) THEN
    -- Get the inquiry_id from the proposal
    SELECT inquiry_id INTO inquiry_id
    FROM proposals
    WHERE id = NEW.proposal_id;
    
    -- If we found an inquiry_id, update its status
    IF inquiry_id IS NOT NULL THEN
      UPDATE inquiries
      SET 
        status = 'payment_completed',
        updated_at = NOW()
      WHERE id = inquiry_id
      AND status != 'payment_completed';
      
      -- Create a payment confirmation message
      INSERT INTO messages (
        inquiry_id,
        sender_id,
        content
      )
      VALUES (
        inquiry_id,
        (SELECT venue_id FROM properties WHERE id = NEW.property_id),
        'Payment of ' || NEW.price_total || ' ' || NEW.currency || ' has been received and confirmed for booking ' || 
        substring(NEW.id::text, 1, 8) || '... from ' || NEW.start_date || ' to ' || NEW.end_date || '.'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add a trigger to the bookings table
DROP TRIGGER IF EXISTS update_inquiry_on_payment ON bookings;
CREATE TRIGGER update_inquiry_on_payment
AFTER UPDATE ON bookings
FOR EACH ROW
EXECUTE FUNCTION update_inquiry_status_on_payment();

-- Add a comment to explain the trigger
COMMENT ON TRIGGER update_inquiry_on_payment ON bookings IS 'Updates inquiry status to payment_completed when booking payment_status changes to paid';