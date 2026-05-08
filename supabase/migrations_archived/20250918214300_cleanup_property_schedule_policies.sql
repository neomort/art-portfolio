-- +goose Up
-- Cleanup conflicting/overlapping policies on public.property_schedule and create a minimal, correct set

-- Ensure RLS is enabled
ALTER TABLE public.property_schedule ENABLE ROW LEVEL SECURITY;

-- Drop conflicting or legacy policies if they exist
DROP POLICY IF EXISTS "Org members can manage schedules" ON public.property_schedule;
DROP POLICY IF EXISTS "Property owners can manage schedules" ON public.property_schedule;
DROP POLICY IF EXISTS "Property schedules are publicly viewable" ON public.property_schedule;
DROP POLICY IF EXISTS "property_schedule_public_select" ON public.property_schedule;
DROP POLICY IF EXISTS "property_schedule_public_if_published" ON public.property_schedule;
DROP POLICY IF EXISTS "property_schedule_owner_read" ON public.property_schedule;

-- Also drop any previous variants we may have created during debugging
DROP POLICY IF EXISTS "owner_full_access" ON public.property_schedule;
DROP POLICY IF EXISTS "public_read_access" ON public.property_schedule;
DROP POLICY IF EXISTS "service_role_access" ON public.property_schedule;

-- Recreate a minimal, explicit set of policies
-- 1) Owner full CRUD access (venue owner of the property)
CREATE POLICY "schedule_owner_full_access" ON public.property_schedule
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = public.property_schedule.property_id
        AND p.venue_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = public.property_schedule.property_id
        AND p.venue_id = auth.uid()
    )
  );

-- 2) Public read access only for published properties (for availability display)
CREATE POLICY "schedule_public_read_published" ON public.property_schedule
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = public.property_schedule.property_id
        AND p.published = true
    )
  );

-- 3) Service role override for backend/edge functions
CREATE POLICY "schedule_service_role_all" ON public.property_schedule
  FOR ALL
  USING (auth.role() = 'service_role');

-- Helpful index (no-op if already present)
CREATE INDEX IF NOT EXISTS idx_property_schedule_property_id ON public.property_schedule (property_id);

-- +goose Down
DROP POLICY IF EXISTS "schedule_owner_full_access" ON public.property_schedule;
DROP POLICY IF EXISTS "schedule_public_read_published" ON public.property_schedule;
DROP POLICY IF EXISTS "schedule_service_role_all" ON public.property_schedule;
