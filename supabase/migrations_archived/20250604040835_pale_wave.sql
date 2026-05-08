/*
  # Fix Review Responses RLS Policy

  1. Changes
    - Add proper RLS policy for review responses table to allow authenticated users to insert responses
    - Ensure responder_id is set to the authenticated user's ID
    - Keep existing policies for viewing and updating responses

  2. Security
    - Enable RLS on review_responses table (already enabled)
    - Add policy for inserting review responses
*/

-- Drop the existing INSERT policies to avoid conflicts
DROP POLICY IF EXISTS "Property owners can respond to reviews" ON review_responses;
DROP POLICY IF EXISTS "Venue owners can respond to reviews" ON review_responses;

-- Create new INSERT policy
CREATE POLICY "Users can insert review responses"
ON review_responses
FOR INSERT
TO authenticated
WITH CHECK (
  -- Ensure the responder_id matches the authenticated user
  auth.uid() = responder_id AND
  -- Verify the user owns the property associated with the review
  EXISTS (
    SELECT 1
    FROM reviews r
    JOIN properties p ON r.property_id = p.id
    WHERE r.id = review_responses.review_id
    AND p.venue_id = auth.uid()
  )
);