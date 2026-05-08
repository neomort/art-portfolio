-- Reconciliation migration: restore intended RLS and policies
-- - Remove abandoned helpers
-- - Enforce public-read where intended (properties/reviews/pages)
-- - Enforce profiles as authenticated-only (own row)

begin;

-- 1) Remove abandoned organization helper if present
DROP FUNCTION IF EXISTS public.get_org_by_slug(text);

-- 2) Base grants
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- 3) Properties: public may read only published
GRANT SELECT ON public.properties TO anon, authenticated;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS properties_public_published ON public.properties;
CREATE POLICY properties_public_published
  ON public.properties
  FOR SELECT
  TO anon, authenticated
  USING (published = true);

-- 4) Reviews: public may read approved only
GRANT SELECT ON public.reviews TO anon, authenticated;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reviews_public_approved ON public.reviews;
CREATE POLICY reviews_public_approved
  ON public.reviews
  FOR SELECT
  TO anon, authenticated
  USING (status = 'approved');

-- 5) Pages: public read (Support/Legal listings use this)
GRANT SELECT ON public.pages TO anon, authenticated;
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pages_public_read ON public.pages;
CREATE POLICY pages_public_read
  ON public.pages
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- 6) Profiles: authenticated-only own access
-- No public read per product decision. Admin-wide read via JWT helper may be added later.
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

commit;
