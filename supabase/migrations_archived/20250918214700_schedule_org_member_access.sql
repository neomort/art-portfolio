-- +goose Up
-- Allow org members to fully manage schedules for properties in their organization
-- Requires organization_members(user_id, organization_id) and properties(organization_id)

-- Ensure RLS remains enabled (no-op if already enabled)
ALTER TABLE public.property_schedule ENABLE ROW LEVEL SECURITY;

-- Create org member policy (FOR ALL + WITH CHECK)
CREATE POLICY "schedule_org_member_full_access" ON public.property_schedule
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT m.user_id
      FROM public.organization_members m
      WHERE m.organization_id = (
        SELECT p.organization_id FROM public.properties p WHERE p.id = public.property_schedule.property_id
      )
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT m.user_id
      FROM public.organization_members m
      WHERE m.organization_id = (
        SELECT p.organization_id FROM public.properties p WHERE p.id = public.property_schedule.property_id
      )
    )
  );

-- +goose Down
DROP POLICY IF EXISTS "schedule_org_member_full_access" ON public.property_schedule;
