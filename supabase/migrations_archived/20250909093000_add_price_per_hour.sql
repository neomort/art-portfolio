-- Add price_per_hour to properties for hourly pricing
ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS price_per_hour numeric NULL;

-- Optional: create a partial index to speed up queries filtering by hourly price
CREATE INDEX IF NOT EXISTS idx_properties_price_per_hour
  ON public.properties (price_per_hour)
  WHERE price_per_hour IS NOT NULL;
