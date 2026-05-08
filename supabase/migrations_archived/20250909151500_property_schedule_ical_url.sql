-- Add external iCal feed URL to property_schedule for blocking availability
ALTER TABLE property_schedule
  ADD COLUMN IF NOT EXISTS ical_url text;

-- Optional index for queries filtering by non-null ical_url
CREATE INDEX IF NOT EXISTS idx_property_schedule_ical_url
  ON property_schedule (property_id)
  WHERE ical_url IS NOT NULL;
