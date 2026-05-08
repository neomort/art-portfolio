-- Allow venue owners to create temporary guest profiles for proposal invitations
-- This policy enables venue owners to create profiles with different IDs for guests
DROP POLICY IF EXISTS "Venue owners can create guest profiles" ON "public"."profiles";

CREATE POLICY "Venue owners can create guest profiles" ON "public"."profiles" FOR INSERT TO "authenticated"
WITH CHECK (
  -- Allow creating guest profiles if:
  -- 1. The profile is marked as temporary (password_set = false)
  -- 2. The profile has invited_via_proposal_id set
  -- 3. The creator is a venue owner (owns at least one property)
  (password_set = false AND invited_via_proposal_id IS NOT NULL) AND
  EXISTS (
    SELECT 1 FROM public.properties 
    WHERE venue_id = auth.uid()
    LIMIT 1
  )
);
