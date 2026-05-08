-- Add properties.organization_id and update org-aware policies to use it directly

BEGIN;

-- 1) Add organization_id column on properties if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='properties' AND column_name='organization_id'
  ) THEN
    ALTER TABLE public.properties ADD COLUMN organization_id uuid;
  END IF;
END $$;

-- 2) Backfill from venue's primary organization
UPDATE public.properties prop
SET organization_id = pr.primary_organization_id
FROM public.profiles pr
WHERE prop.venue_id = pr.id
  AND prop.organization_id IS NULL;

-- 3) Add FK and index (deferrable to avoid lock issues); do not set NOT NULL yet
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'properties_organization_id_fkey'
  ) THEN
    ALTER TABLE public.properties
      ADD CONSTRAINT properties_organization_id_fkey
      FOREIGN KEY (organization_id)
      REFERENCES public.organizations(id)
      ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_properties_organization_id ON public.properties(organization_id);

-- 4) Replace org-aware policies to use properties.organization_id directly
-- Drop existing policies if present
DROP POLICY IF EXISTS properties_insert_org ON public.properties;
DROP POLICY IF EXISTS properties_update_org ON public.properties;
DROP POLICY IF EXISTS properties_delete_org ON public.properties;
DROP POLICY IF EXISTS property_availability_manage_org ON public.property_availability;
DROP POLICY IF EXISTS inquiries_select_org ON public.inquiries;
DROP POLICY IF EXISTS proposals_select_org ON public.proposals;
DROP POLICY IF EXISTS proposals_insert_org ON public.proposals;
DROP POLICY IF EXISTS bookings_select_org ON public.bookings;
DROP POLICY IF EXISTS bookings_update_org ON public.bookings;

-- Recreate properties policies (browse policy unchanged elsewhere)
CREATE POLICY properties_insert_org
  ON public.properties FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = properties.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner','admin','member')
    )
  );

CREATE POLICY properties_update_org
  ON public.properties FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = properties.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner','admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = properties.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner','admin')
    )
  );

CREATE POLICY properties_delete_org
  ON public.properties FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = properties.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner','admin')
    )
  );

-- property_availability
CREATE POLICY property_availability_manage_org
  ON public.property_availability FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.properties prop
      JOIN public.organization_members om ON om.organization_id = prop.organization_id
      WHERE prop.id = property_availability.property_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner','admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.properties prop
      JOIN public.organization_members om ON om.organization_id = prop.organization_id
      WHERE prop.id = property_availability.property_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner','admin')
    )
  );

-- inquiries select (requester OR org members of the venue)
CREATE POLICY inquiries_select_org
  ON public.inquiries FOR SELECT TO authenticated
  USING (
    inquiries.user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.properties prop
      JOIN public.organization_members om ON om.organization_id = prop.organization_id
      WHERE prop.id = inquiries.property_id
        AND om.user_id = auth.uid()
    )
  );

-- proposals
CREATE POLICY proposals_select_org
  ON public.proposals FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.inquiries iq
      WHERE iq.id = proposals.inquiry_id
        AND iq.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.inquiries iq
      JOIN public.properties prop ON prop.id = iq.property_id
      JOIN public.organization_members om ON om.organization_id = prop.organization_id
      WHERE iq.id = proposals.inquiry_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY proposals_insert_org
  ON public.proposals FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.inquiries iq
      JOIN public.properties prop ON prop.id = iq.property_id
      JOIN public.organization_members om ON om.organization_id = prop.organization_id
      WHERE iq.id = proposals.inquiry_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner','admin')
    )
  );

-- bookings
CREATE POLICY bookings_select_org
  ON public.bookings FOR SELECT TO authenticated
  USING (
    bookings.user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.properties prop
      JOIN public.organization_members om ON om.organization_id = prop.organization_id
      WHERE prop.id = bookings.property_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY bookings_update_org
  ON public.bookings FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.properties prop
      JOIN public.organization_members om ON om.organization_id = prop.organization_id
      WHERE prop.id = bookings.property_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner','admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.properties prop
      JOIN public.organization_members om ON om.organization_id = prop.organization_id
      WHERE prop.id = bookings.property_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner','admin')
    )
  );

COMMIT;
