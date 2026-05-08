/*
  # Fix review responses policies

  1. Changes
    - Add safety checks before creating policies
    - Enable RLS if not already enabled
    - Create policies for review responses if they don't exist

  2. Security
    - Maintains existing RLS policies for review responses
    - Ensures venue owners can only respond to their own property reviews
    - Keeps responses publicly viewable
*/

-- Enable RLS if not already enabled
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'review_responses' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE review_responses ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Add policy for inserting responses if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'review_responses' 
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
END $$;

-- Add policy for selecting responses if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'review_responses' 
    AND policyname = 'Review responses are viewable by everyone'
  ) THEN
    CREATE POLICY "Review responses are viewable by everyone"
    ON review_responses
    FOR SELECT
    TO public
    USING (true);
  END IF;
END $$;