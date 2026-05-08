-- Ensure properties has all columns used by ManagePropertyPage pricing, fees, adjustments, and files
-- Safe to run multiple times due to IF NOT EXISTS

begin;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS fee_type text,
  ADD COLUMN IF NOT EXISTS fee_value numeric(10,2),
  ADD COLUMN IF NOT EXISTS fee_description text,
  ADD COLUMN IF NOT EXISTS weekly_rate numeric(10,2),
  ADD COLUMN IF NOT EXISTS weekly_percent integer,
  ADD COLUMN IF NOT EXISTS monthly_rate numeric(10,2),
  ADD COLUMN IF NOT EXISTS monthly_percent integer,
  ADD COLUMN IF NOT EXISTS yearly_rate numeric(12,2),
  ADD COLUMN IF NOT EXISTS yearly_percent integer,
  ADD COLUMN IF NOT EXISTS price_per_hour numeric(10,2),
  ADD COLUMN IF NOT EXISTS space_attributes text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS applied_adjustment_ids text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS virtual_tour_url text,
  ADD COLUMN IF NOT EXISTS downloadable_files jsonb DEFAULT '[]'::jsonb;

-- Indexes for arrays/JSON can be added later if needed for querying

commit;
