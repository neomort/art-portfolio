/*
  # Update Reviews RLS Policy

  1. Changes
    - Modify the INSERT policy for reviews to allow users to create reviews if:
      a) They are the reviewer (reviewer_id matches their uid)
      b) The property exists
    - This maintains basic security while removing the inquiry requirement

  2. Security
    - Maintains RLS enforcement
    - Ensures users can only create reviews as themselves
    - Validates property existence
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Users can create reviews for properties they've interacted with" ON "public"."reviews";

-- Create new more permissive policy
CREATE POLICY "Users can create reviews" ON "public"."reviews"
FOR INSERT TO public
WITH CHECK (
  (reviewer_id = auth.uid()) AND 
  EXISTS (
    SELECT 1 FROM properties 
    WHERE properties.id = property_id
  )
);