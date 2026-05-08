-- Add time-precise fields for hourly bookings without breaking daily flows
-- 1) Add timestamptz columns and a kind discriminator
DO $$
BEGIN
  IF to_regclass('public.bookings') IS NOT NULL THEN
    -- Columns (idempotent)
    BEGIN
      ALTER TABLE public.bookings
        ADD COLUMN IF NOT EXISTS start_at timestamptz NULL,
        ADD COLUMN IF NOT EXISTS end_at timestamptz NULL,
        ADD COLUMN IF NOT EXISTS kind text CHECK (kind IN ('daily','hourly','blocked')) DEFAULT 'daily';
    EXCEPTION WHEN duplicate_column THEN
      -- ignore if already present
      NULL;
    END;

    -- Helpful index
    CREATE INDEX IF NOT EXISTS idx_bookings_property_time
      ON public.bookings (property_id, start_at, end_at);

    -- Optionally backfill start_at/end_at from dates where missing
    -- Here we treat end_date as exclusive by adding 1 day at midnight
    UPDATE public.bookings
    SET start_at = (start_date)::timestamptz,
        end_at   = (end_date + INTERVAL '1 day')::timestamptz
    WHERE start_at IS NULL AND end_at IS NULL AND start_date IS NOT NULL AND end_date IS NOT NULL;

    -- Prevent overlap for confirmed/blocked if you have a status column
    -- Requires btree_gist
    CREATE EXTENSION IF NOT EXISTS btree_gist;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'bookings_no_overlap_per_property'
    ) THEN
      -- Only create the exclusion constraint if no existing rows overlap
      IF NOT EXISTS (
        SELECT 1
        FROM public.bookings b1
        JOIN public.bookings b2
          ON b1.property_id = b2.property_id
         AND b1.id <> b2.id
         AND b1.status IN ('confirmed','blocked')
         AND b2.status IN ('confirmed','blocked')
         AND tstzrange(b1.start_at, b1.end_at, '[)') && tstzrange(b2.start_at, b2.end_at, '[)')
      ) THEN
        ALTER TABLE public.bookings
          ADD CONSTRAINT bookings_no_overlap_per_property
          EXCLUDE USING gist (
            property_id WITH =,
            tstzrange(start_at, end_at, '[)') WITH &&
          ) WHERE (status IN ('confirmed','blocked'));
      ELSE
        RAISE NOTICE 'Skipped adding bookings_no_overlap_per_property due to existing overlapping rows. Please clean up overlaps and add the constraint later.';
      END IF;
    END IF;
  END IF;
END $$;
