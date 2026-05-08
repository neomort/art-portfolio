-- Fix RLS policies for inquiries table to support both participants and organization members
-- This replaces the restrictive policies with comprehensive ones that allow proper access

BEGIN;

-- Drop all existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can insert their own inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Users can view their own inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Users can update their own inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Participants or org members can read inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Participants or org members can update inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Users can insert inquiries" ON public.inquiries;

-- Create comprehensive INSERT policy - users can insert inquiries
CREATE POLICY "Users can insert inquiries"
ON public.inquiries
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Create comprehensive SELECT policy - participants OR org members can read inquiries
CREATE POLICY "Participants or org members can read inquiries"
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

-- Create comprehensive UPDATE policy - participants OR org members can update inquiries
CREATE POLICY "Participants or org members can update inquiries"
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

COMMIT;
