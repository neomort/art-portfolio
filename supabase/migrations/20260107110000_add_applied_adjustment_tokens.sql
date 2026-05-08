ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS applied_adjustment_tokens text[];
