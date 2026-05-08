-- +goose Up
-- Create a SECURITY DEFINER helper to evaluate ownership/org membership without being blocked by RLS on properties/organization_members

-- Ensure search_path is safe within the function
CREATE OR REPLACE FUNCTION public.can_manage_property_schedule(_property_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _can boolean := false;
BEGIN
  -- Check venue ownership OR organization membership
  SELECT EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = _property_id
      AND (
        p.venue_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.organization_members m
          WHERE m.organization_id = p.organization_id
            AND m.user_id = auth.uid()
        )
      )
  ) INTO _can;

  RETURN COALESCE(_can, false);
END;
$$;

-- Lock down and grant execute to app roles
REVOKE ALL ON FUNCTION public.can_manage_property_schedule(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_property_schedule(uuid) TO anon, authenticated, service_role;

-- Ensure RLS remains enabled on target table
ALTER TABLE public.property_schedule ENABLE ROW LEVEL SECURITY;

-- Replace existing manage policies with a single function-based policy
DROP POLICY IF EXISTS "schedule_owner_full_access" ON public.property_schedule;
DROP POLICY IF EXISTS "schedule_org_member_full_access" ON public.property_schedule;

CREATE POLICY "schedule_manage_via_fn" ON public.property_schedule
  FOR ALL
  USING (public.can_manage_property_schedule(public.property_schedule.property_id))
  WITH CHECK (public.can_manage_property_schedule(public.property_schedule.property_id));

-- Keep previously added public read (published) and service role policies as-is
-- +goose Down
DROP POLICY IF EXISTS "schedule_manage_via_fn" ON public.property_schedule;
DROP FUNCTION IF EXISTS public.can_manage_property_schedule(uuid);
