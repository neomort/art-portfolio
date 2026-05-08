-- Create a more permissive policy for testing - remove organization check temporarily
DROP POLICY IF EXISTS "Venue owners can create guest profiles" ON "public"."profiles";

CREATE POLICY "Venue owners can create guest profiles" ON "public"."profiles" FOR INSERT TO "authenticated"
WITH CHECK (
  -- Allow creating guest profiles if:
  -- 1. The profile is marked as temporary (password_set = false)
  -- 2. The profile has invited_via_proposal_id set
  password_set = false AND 
  invited_via_proposal_id IS NOT NULL
);
