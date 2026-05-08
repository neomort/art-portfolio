-- +goose Up
-- Ensure required privileges and constraints for property_schedule

-- Unique constraint to support on_conflict=property_id upserts (safe if already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'property_schedule_property_id_key'
      AND conrelid = 'public.property_schedule'::regclass
  ) THEN
    ALTER TABLE public.property_schedule
      ADD CONSTRAINT property_schedule_property_id_key UNIQUE (property_id);
  END IF;
END $$;

-- Grant CRUD to authenticated (policies still gate access)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.property_schedule TO authenticated;

-- Public can read (policies will still enforce published=true)
GRANT SELECT ON TABLE public.property_schedule TO anon;

-- +goose Down
ALTER TABLE public.property_schedule DROP CONSTRAINT IF EXISTS property_schedule_property_id_key;
