-- Add Brevo opt-in columns to profiles
DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS brevo_opt_in boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS brevo_opt_in_ts timestamptz;
EXCEPTION WHEN duplicate_column THEN
  -- ignore
  NULL;
END $$;

-- Create helpful index for downstream processing
CREATE INDEX IF NOT EXISTS idx_profiles_brevo_opt_in ON public.profiles (brevo_opt_in);
