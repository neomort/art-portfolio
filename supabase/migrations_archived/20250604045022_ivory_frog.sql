/*
  # Update review responses policies

  1. Changes
    - Drop existing policy "Venue owners can respond to reviews"
    - Recreate policy with updated conditions
    - Add policy for viewing responses

  2. Security
    - Enable RLS
    - Add policy for venue owners to respond to reviews
    - Add policy for public viewing of responses
*/

-- Enable RLS if not already enabled
ALTER TABLE review_responses ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Venue owners can respond to reviews" ON review_responses;

-- Add policy for inserting responses
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

-- Add policy for selecting responses
DROP POLICY IF EXISTS "Review responses are viewable by everyone" ON review_responses;
CREATE POLICY "Review responses are viewable by everyone"
ON review_responses
FOR SELECT
TO public
USING (true);