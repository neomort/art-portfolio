/*
  # Fix review responses RLS policies

  1. Changes
    - Drop existing policies if they exist
    - Enable RLS on review_responses table
    - Add policies for:
      - Public viewing of responses
      - Venue owners responding to reviews
    
  2. Security
    - Maintains existing security model
    - Ensures policies are created only if they don't exist
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Review responses are viewable by everyone" ON review_responses;
DROP POLICY IF EXISTS "Venue owners can respond to reviews" ON review_responses;

-- Enable RLS
ALTER TABLE review_responses ENABLE ROW LEVEL SECURITY;

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
CREATE POLICY "Review responses are viewable by everyone"
ON review_responses
FOR SELECT
TO public
USING (true);