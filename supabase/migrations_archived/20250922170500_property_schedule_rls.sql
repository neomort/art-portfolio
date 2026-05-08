-- RLS policies for property_schedule to allow venue owners and ALL org members
-- (owner, admin, member) to manage a property's schedule

begin;

ALTER TABLE public.property_schedule ENABLE ROW LEVEL SECURITY;

-- Base grants (RLS still applies)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_schedule TO authenticated;
GRANT ALL ON public.property_schedule TO service_role;

-- Clean up old policies if any
DROP POLICY IF EXISTS property_schedule_select ON public.property_schedule;
DROP POLICY IF EXISTS property_schedule_insert ON public.property_schedule;
DROP POLICY IF EXISTS property_schedule_update ON public.property_schedule;
DROP POLICY IF EXISTS property_schedule_delete ON public.property_schedule;

-- Helper predicate used in policies (expressed inline):
-- The acting user must be either the venue owner for the linked property
-- OR a member (owner/admin/member) of the linked property's organization.
-- We join from property_schedule.property_id -> properties.id and check venue/org membership.

-- SELECT
CREATE POLICY property_schedule_select
ON public.property_schedule
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.properties p
    LEFT JOIN public.organization_members om
      ON om.organization_id = p.organization_id
      AND om.user_id = auth.uid()
    WHERE p.id = property_schedule.property_id
      AND (
        p.venue_id = auth.uid()
        OR (om.role IN ('owner','admin','member'))
      )
  )
);

-- INSERT
CREATE POLICY property_schedule_insert
ON public.property_schedule
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.properties p
    LEFT JOIN public.organization_members om
      ON om.organization_id = p.organization_id
      AND om.user_id = auth.uid()
    WHERE p.id = property_schedule.property_id
      AND (
        p.venue_id = auth.uid()
        OR (om.role IN ('owner','admin','member'))
      )
  )
);

-- UPDATE
CREATE POLICY property_schedule_update
ON public.property_schedule
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.properties p
    LEFT JOIN public.organization_members om
      ON om.organization_id = p.organization_id
      AND om.user_id = auth.uid()
    WHERE p.id = property_schedule.property_id
      AND (
        p.venue_id = auth.uid()
        OR (om.role IN ('owner','admin','member'))
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.properties p
    LEFT JOIN public.organization_members om
      ON om.organization_id = p.organization_id
      AND om.user_id = auth.uid()
    WHERE p.id = property_schedule.property_id
      AND (
        p.venue_id = auth.uid()
        OR (om.role IN ('owner','admin','member'))
      )
  )
);

-- DELETE
CREATE POLICY property_schedule_delete
ON public.property_schedule
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.properties p
    LEFT JOIN public.organization_members om
      ON om.organization_id = p.organization_id
      AND om.user_id = auth.uid()
    WHERE p.id = property_schedule.property_id
      AND (
        p.venue_id = auth.uid()
        OR (om.role IN ('owner','admin','member'))
      )
  )
);

commit;
