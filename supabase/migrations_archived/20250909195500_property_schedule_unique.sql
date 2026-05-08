-- Ensure one schedule per property to support upserts on property_id
-- 1) Remove duplicates (keep the most recent per property)
WITH ranked AS (
  SELECT id, property_id, created_at,
         ROW_NUMBER() OVER (PARTITION BY property_id ORDER BY created_at DESC) AS rn
  FROM property_schedule
)
DELETE FROM property_schedule ps
USING ranked r
WHERE ps.id = r.id
  AND r.rn > 1;

-- 2) Create a unique index on property_id so ON CONFLICT (property_id) works
CREATE UNIQUE INDEX IF NOT EXISTS ux_property_schedule_property_id
  ON property_schedule(property_id);
