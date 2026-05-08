/*
  # Fix review responses policies

  1. Changes
    - Ensure RLS is enabled on review_responses table
    - Add policy for venue owners to respond to reviews
    - Safely check if policies already exist before creating

  2. Security
    - Maintains existing RLS for review_responses table
*/

-- Enable RLS (idempotent operation, safe to run multiple times)
ALTER TABLE review_responses ENABLE ROW LEVEL SECURITY;

-- Add policy for inserting responses (with existence check)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'review_responses' 
    AND policyname = 'Venue owners can respond to reviews'
  ) THEN
    CREATE POLICY "Venue owners can respond to reviews"
    ON review_responses
    FOR INSERT
    TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 
        FROM reviews r
        JOIN properties p ON r.property_id = p.id
        WHERE r.id = review_id 
        AND p.venue_id = auth.uid()
        AND auth.uid() = responder_id
      )
    );
  END IF;
END
$$;

-- Add policy for selecting responses (with existence check)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'review_responses' 
    AND policyname = 'Review responses are viewable by everyone'
  ) THEN
    CREATE POLICY "Review responses are viewable by everyone"
    ON review_responses
    FOR SELECT
    TO public
    USING (true);
  END IF;
END
$$;