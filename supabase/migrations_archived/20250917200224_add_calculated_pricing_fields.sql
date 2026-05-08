-- Add calculated pricing fields for weekly, monthly, and yearly rates
-- These fields will store both the calculated rate and the percentage discount

ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS weekly_rate numeric(10,2),
ADD COLUMN IF NOT EXISTS weekly_percent integer,
ADD COLUMN IF NOT EXISTS monthly_rate numeric(10,2),
ADD COLUMN IF NOT EXISTS monthly_percent integer,
ADD COLUMN IF NOT EXISTS yearly_rate numeric(10,2),
ADD COLUMN IF NOT EXISTS yearly_percent integer;
