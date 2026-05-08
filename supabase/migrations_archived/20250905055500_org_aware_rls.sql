-- Organization-aware RLS based on organization_members and profiles.primary_organization_id
-- Idempotent: drop old policies if they exist, then create org-aware ones.

BEGIN;

-- PROPERTIES
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

-- Drop prior user-id centric policies
DROP POLICY IF EXISTS "Users can insert their own properties" ON public.properties;
DROP POLICY IF EXISTS "Users can update their own properties" ON public.properties;
DROP POLICY IF EXISTS "Users can delete their own properties" ON public.properties;
-- Keep public browse as-is (optional). If you want to restrict, drop next line.
-- Ensure the browse policy exists; recreate if missing
DROP POLICY IF EXISTS "Properties are viewable by everyone" ON public.properties;
CREATE POLICY "Properties are viewable by everyone"
  ON public.properties FOR SELECT
  USING (true);

-- Insert allowed for org owners/admins of the venue's primary organization
CREATE POLICY properties_insert_org
  ON public.properties FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles pr
      JOIN organization_members om ON om.organization_id = pr.primary_organization_id
      WHERE pr.id = properties.venue_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner','admin')
    )
  );

-- Update allowed for org owners/admins
CREATE POLICY properties_update_org
  ON public.properties FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles pr
      JOIN organization_members om ON om.organization_id = pr.primary_organization_id
      WHERE pr.id = properties.venue_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner','admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles pr
      JOIN organization_members om ON om.organization_id = pr.primary_organization_id
      WHERE pr.id = properties.venue_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner','admin')
    )
  );

-- Delete allowed for org owners/admins
CREATE POLICY properties_delete_org
  ON public.properties FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles pr
      JOIN organization_members om ON om.organization_id = pr.primary_organization_id
      WHERE pr.id = properties.venue_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner','admin')
    )
  );

-- PROPERTY AVAILABILITY
ALTER TABLE public.property_availability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Property owners can manage availability" ON public.property_availability;
DROP POLICY IF EXISTS "Property availability is viewable by everyone" ON public.property_availability;

CREATE POLICY property_availability_select_public
  ON public.property_availability FOR SELECT
  USING (true);

CREATE POLICY property_availability_manage_org
  ON public.property_availability FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM properties prop
      JOIN profiles pr ON pr.id = prop.venue_id
      JOIN organization_members om ON om.organization_id = pr.primary_organization_id
      WHERE prop.id = property_availability.property_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner','admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM properties prop
      JOIN profiles pr ON pr.id = prop.venue_id
      JOIN organization_members om ON om.organization_id = pr.primary_organization_id
      WHERE prop.id = property_availability.property_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner','admin')
    )
  );

-- INQUIRIES
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Authenticated users can create inquiries" ON public.inquiries;

-- Select: requester OR org members of the venue
CREATE POLICY inquiries_select_org
  ON public.inquiries FOR SELECT TO authenticated
  USING (
    inquiries.user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM properties prop
      JOIN profiles pr ON pr.id = prop.venue_id
      JOIN organization_members om ON om.organization_id = pr.primary_organization_id
      WHERE prop.id = inquiries.property_id
        AND om.user_id = auth.uid()
    )
  );

-- Insert: requester must match
CREATE POLICY inquiries_insert_self
  ON public.inquiries FOR INSERT TO authenticated
  WITH CHECK (inquiries.user_id = auth.uid());

-- PROPOSALS
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their related proposals" ON public.proposals;
DROP POLICY IF EXISTS "Property owners can create proposals" ON public.proposals;

-- Select: requester of inquiry OR org members of venue
CREATE POLICY proposals_select_org
  ON public.proposals FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM inquiries iq
      WHERE iq.id = proposals.inquiry_id
        AND iq.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM inquiries iq
      JOIN properties prop ON prop.id = iq.property_id
      JOIN profiles pr ON pr.id = prop.venue_id
      JOIN organization_members om ON om.organization_id = pr.primary_organization_id
      WHERE iq.id = proposals.inquiry_id
        AND om.user_id = auth.uid()
    )
  );

-- Insert: org owners/admins only
CREATE POLICY proposals_insert_org
  ON public.proposals FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM inquiries iq
      JOIN properties prop ON prop.id = iq.property_id
      JOIN profiles pr ON pr.id = prop.venue_id
      JOIN organization_members om ON om.organization_id = pr.primary_organization_id
      WHERE iq.id = proposals.inquiry_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner','admin')
    )
  );

-- BOOKINGS
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their related bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can create bookings" ON public.bookings;

-- Select: requester or org members of the venue
CREATE POLICY bookings_select_org
  ON public.bookings FOR SELECT TO authenticated
  USING (
    bookings.user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM properties prop
      JOIN profiles pr ON pr.id = prop.venue_id
      JOIN organization_members om ON om.organization_id = pr.primary_organization_id
      WHERE prop.id = bookings.property_id
        AND om.user_id = auth.uid()
    )
  );

-- Insert: requester must match
CREATE POLICY bookings_insert_self
  ON public.bookings FOR INSERT TO authenticated
  WITH CHECK (bookings.user_id = auth.uid());

-- Update: org owners/admins only
CREATE POLICY bookings_update_org
  ON public.bookings FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM properties prop
      JOIN profiles pr ON pr.id = prop.venue_id
      JOIN organization_members om ON om.organization_id = pr.primary_organization_id
      WHERE prop.id = bookings.property_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner','admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM properties prop
      JOIN profiles pr ON pr.id = prop.venue_id
      JOIN organization_members om ON om.organization_id = pr.primary_organization_id
      WHERE prop.id = bookings.property_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner','admin')
    )
  );

COMMIT;
