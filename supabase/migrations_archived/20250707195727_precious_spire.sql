/*
  # Fix notification format and add payment_completed status

  1. Changes
     - Ensure payment_completed status is available for inquiries
     - This allows the UI to properly display payment status in message threads
*/

-- Add 'payment_completed' to the inquiry status check constraint if not already added
DO $$ 
BEGIN
  -- Check if the constraint exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'inquiries_status_check'
  ) THEN
    -- Check if the constraint already includes 'payment_completed'
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE c.conname = 'inquiries_status_check'
      AND pg_get_constraintdef(c.oid) LIKE '%payment_completed%'
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
  END IF;
END $$;