/*
  # Add payment_completed status to inquiries

  1. Changes
     - Add 'payment_completed' as a valid status for inquiries
*/

-- Add 'payment_completed' to the inquiry status check constraint
DO $$ 
BEGIN
  -- Check if the constraint exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'inquiries_status_check'
  ) THEN
    -- Drop the existing constraint
    ALTER TABLE inquiries DROP CONSTRAINT IF EXISTS inquiries_status_check;
    
    -- Add the new constraint with the additional status
    ALTER TABLE inquiries ADD CONSTRAINT inquiries_status_check 
      CHECK (status = ANY (ARRAY[
        'pending'::text, 
        'viewed'::text, 
        'responded'::text, 
        'converted_to_proposal'::text, 
        'declined'::text, 
        'closed'::text,
        'payment_completed'::text
      ]));
  END IF;
END $$;