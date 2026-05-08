-- Ensure properties has neighborhood and metro_area columns in production

begin;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS neighborhood text;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS metro_area text;

-- Optional: add simple indexes if you plan to filter by these frequently
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_properties_neighborhood ON public.properties (neighborhood);
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_properties_metro_area ON public.properties (metro_area);
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

commit;
