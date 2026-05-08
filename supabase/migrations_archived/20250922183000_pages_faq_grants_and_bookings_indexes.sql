-- Fix permissions and performance for pages/faq and bookings
begin;

-- 1) Ensure authenticated role has required table privileges (RLS still applies)
GRANT INSERT, UPDATE, DELETE ON public.pages TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.faq_categories TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.faq_entries TO authenticated;

-- 2) Add indexes to reduce bookings dashboard timeouts
-- Adjust based on common filters/sorts used in the app
CREATE INDEX IF NOT EXISTS bookings_property_created_at_idx
  ON public.bookings (property_id, created_at DESC);

CREATE INDEX IF NOT EXISTS bookings_status_created_at_idx
  ON public.bookings (status, created_at DESC);

-- If filtering by user, add:
CREATE INDEX IF NOT EXISTS bookings_user_created_at_idx
  ON public.bookings (user_id, created_at DESC);

-- General sort by created_at to speed up dashboards when no specific filter is applied
CREATE INDEX IF NOT EXISTS bookings_created_at_idx
  ON public.bookings (created_at DESC);

commit;
