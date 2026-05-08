-- Allow venue owners to create temporary guest profiles for proposal invitations
-- This policy enables venue owners to create profiles with different IDs for guests
CREATE POLICY "Venue owners can create guest profiles" ON "public"."profiles" FOR INSERT TO "authenticated"
WITH CHECK (
  -- Allow creating guest profiles if:
  -- 1. The profile is marked as temporary (password_set = false)
  -- 2. The creator is a venue owner (owns at least one property)
  -- 3. The profile has invited_via_proposal_id set
  (password_set = false AND invited_via_proposal_id IS NOT NULL) AND
  EXISTS (
    SELECT 1 FROM public.properties 
    WHERE venue_id = auth.uid()
  )
);

-- Also allow updating guest profiles to set password (for profile completion)
CREATE POLICY "Users can update their own guest profiles" ON "public"."profiles" FOR UPDATE TO "authenticated"
USING (
  id = auth.uid() OR 
  (password_set = false AND invited_via_proposal_id IS NOT NULL)
)
WITH CHECK (
  id = auth.uid() OR 
  (password_set = false AND invited_via_proposal_id IS NOT NULL AND id = auth.uid())
);
