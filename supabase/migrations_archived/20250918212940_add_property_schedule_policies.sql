-- +goose Up
-- Enable RLS if not already enabled
ALTER TABLE property_schedule ENABLE ROW LEVEL SECURITY;

-- Clean up any previous policies that might conflict
DROP POLICY IF EXISTS "owner_access" ON property_schedule;
DROP POLICY IF EXISTS "public_read" ON property_schedule;
DROP POLICY IF EXISTS "owner_full_access" ON property_schedule;
DROP POLICY IF EXISTS "public_read_access" ON property_schedule;
DROP POLICY IF EXISTS "service_role_access" ON property_schedule;

-- Policy 1: Owners (venue_id) can fully manage schedules for their properties
CREATE POLICY "owner_full_access" ON property_schedule
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM properties 
      WHERE properties.id = property_schedule.property_id 
      AND properties.venue_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties 
      WHERE properties.id = property_schedule.property_id 
      AND properties.venue_id = auth.uid()
    )
  );

-- Policy 2: Public read access for availability display
CREATE POLICY "public_read_access" ON property_schedule
  FOR SELECT USING (true);

-- Policy 3: Service role can do anything (backend and edge functions)
CREATE POLICY "service_role_access" ON property_schedule
  FOR ALL USING (auth.role() = 'service_role');

-- Helpful index for joins and policy lookups
CREATE INDEX IF NOT EXISTS idx_property_schedule_property_id ON property_schedule (property_id);

-- +goose Down
DROP POLICY IF EXISTS "owner_full_access" ON property_schedule;
DROP POLICY IF EXISTS "public_read_access" ON property_schedule;
DROP POLICY IF EXISTS "service_role_access" ON property_schedule;
DROP INDEX IF EXISTS idx_property_schedule_property_id;
