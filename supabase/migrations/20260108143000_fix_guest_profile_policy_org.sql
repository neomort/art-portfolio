-- Fix the RLS policy to check for organization membership instead of direct ownership
DROP POLICY IF EXISTS "Venue owners can create guest profiles" ON "public"."profiles";

CREATE POLICY "Venue owners can create guest profiles" ON "public"."profiles" FOR INSERT TO "authenticated"
WITH CHECK (
  -- Allow creating guest profiles if:
  -- 1. The profile is marked as temporary (password_set = false)
  -- 2. The profile has invited_via_proposal_id set
  -- 3. The user is a member of an organization that owns properties
  (password_set = false AND invited_via_proposal_id IS NOT NULL) AND
  EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om 
      WHERE om.user_id = auth.uid()
    )
    LIMIT 1
  )
);
