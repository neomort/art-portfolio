-- Final fix for inquiries RLS policies
-- Remove ALL existing policies and recreate only the correct ones

BEGIN;

-- Drop ALL existing policies on inquiries table
DROP POLICY IF EXISTS "Allow inquiry and property owner updates" ON public.inquiries;
DROP POLICY IF EXISTS "Allow inquiry creators and property owners to delete inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Allow users to view their own inquiries or inquiries for their" ON public.inquiries;
DROP POLICY IF EXISTS "Authenticated users can create inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Participants can read inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Users can insert inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Participants or org members can read inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Participants or org members can update inquiries" ON public.inquiries;

-- Ensure RLS is enabled
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

-- Create INSERT policy - users can create inquiries
CREATE POLICY "Users can create inquiries"
ON public.inquiries
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND auth.uid() IS NOT NULL);

-- Create SELECT policy - comprehensive read access for participants and org members
CREATE POLICY "Participants and org members can read inquiries"
ON public.inquiries
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = inquiries.property_id
      AND (
        p.venue_id = auth.uid()
        OR (
          p.organization_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = p.organization_id AND om.user_id = auth.uid()
          )
        )
      )
  )
);

-- Create UPDATE policy - comprehensive update access for participants and org members
CREATE POLICY "Participants and org members can update inquiries"
ON public.inquiries
FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = inquiries.property_id
      AND (
        p.venue_id = auth.uid()
        OR (
          p.organization_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = p.organization_id AND om.user_id = auth.uid()
          )
        )
      )
  )
)
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = inquiries.property_id
      AND (
        p.venue_id = auth.uid()
        OR (
          p.organization_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = p.organization_id AND om.user_id = auth.uid()
          )
        )
      )
  )
);

-- Create DELETE policy for inquiry creators and property owners
CREATE POLICY "Inquiry creators and property owners can delete inquiries"
ON public.inquiries
FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = inquiries.property_id
      AND p.venue_id = auth.uid()
  )
);

COMMIT;
