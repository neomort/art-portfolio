-- Enable RLS with "public read, owner write" model for the art portfolio.
-- Anonymous + authenticated users can SELECT public-facing data.
-- Writes are restricted to either the row's owner (reviews) or service_role only
-- for content tables managed via admin tooling.

-- ---------------------------------------------------------------------------
-- Revoke broad anon/authenticated write privileges previously granted
-- ---------------------------------------------------------------------------
REVOKE ALL ON TABLE public.amenities         FROM anon, authenticated;
REVOKE ALL ON TABLE public.organizations     FROM anon, authenticated;
REVOKE ALL ON TABLE public.pages             FROM anon, authenticated;
REVOKE ALL ON TABLE public.properties        FROM anon, authenticated;
REVOKE ALL ON TABLE public.property_schedule FROM anon, authenticated;
REVOKE ALL ON TABLE public.property_types    FROM anon, authenticated;
REVOKE ALL ON TABLE public.reviews           FROM anon, authenticated;

-- Re-grant minimum required privileges. RLS will further restrict access.
GRANT SELECT ON public.amenities,
                public.organizations,
                public.pages,
                public.properties,
                public.property_schedule,
                public.property_types,
                public.reviews
  TO anon, authenticated;

-- Authenticated users need write privileges on reviews (RLS enforces ownership).
GRANT INSERT, UPDATE, DELETE ON public.reviews TO authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.amenities         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pages             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_types    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews           ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owners that connect via PostgREST.
ALTER TABLE public.amenities         FORCE ROW LEVEL SECURITY;
ALTER TABLE public.organizations     FORCE ROW LEVEL SECURITY;
ALTER TABLE public.pages             FORCE ROW LEVEL SECURITY;
ALTER TABLE public.properties        FORCE ROW LEVEL SECURITY;
ALTER TABLE public.property_schedule FORCE ROW LEVEL SECURITY;
ALTER TABLE public.property_types    FORCE ROW LEVEL SECURITY;
ALTER TABLE public.reviews           FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Helper: drop policies if they exist (idempotent re-runs)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS amenities_public_select         ON public.amenities;
DROP POLICY IF EXISTS organizations_public_select     ON public.organizations;
DROP POLICY IF EXISTS pages_public_select             ON public.pages;
DROP POLICY IF EXISTS properties_public_select        ON public.properties;
DROP POLICY IF EXISTS property_schedule_public_select ON public.property_schedule;
DROP POLICY IF EXISTS property_types_public_select    ON public.property_types;
DROP POLICY IF EXISTS reviews_public_select           ON public.reviews;
DROP POLICY IF EXISTS reviews_owner_insert            ON public.reviews;
DROP POLICY IF EXISTS reviews_owner_update            ON public.reviews;
DROP POLICY IF EXISTS reviews_owner_delete            ON public.reviews;

-- ---------------------------------------------------------------------------
-- Public-read policies (anon + authenticated)
-- ---------------------------------------------------------------------------

-- Lookup tables: open read.
CREATE POLICY amenities_public_select ON public.amenities
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY property_types_public_select ON public.property_types
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY organizations_public_select ON public.organizations
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY pages_public_select ON public.pages
  FOR SELECT TO anon, authenticated USING (true);

-- Properties: only published rows are visible to the public site.
CREATE POLICY properties_public_select ON public.properties
  FOR SELECT TO anon, authenticated
  USING (published = true);

-- Property schedule is joined for availability display; public read.
CREATE POLICY property_schedule_public_select ON public.property_schedule
  FOR SELECT TO anon, authenticated USING (true);

-- ---------------------------------------------------------------------------
-- Reviews: owner-write, public-read (approved only for anon)
-- ---------------------------------------------------------------------------

-- Anyone can read approved reviews; signed-in users also see their own pending.
CREATE POLICY reviews_public_select ON public.reviews
  FOR SELECT TO anon, authenticated
  USING (
    status = 'approved'
    OR (auth.uid() IS NOT NULL AND reviewer_id = auth.uid())
  );

-- Authenticated users can create reviews where they are the reviewer.
CREATE POLICY reviews_owner_insert ON public.reviews
  FOR INSERT TO authenticated
  WITH CHECK (reviewer_id = auth.uid());

-- Owners can update their own reviews.
CREATE POLICY reviews_owner_update ON public.reviews
  FOR UPDATE TO authenticated
  USING (reviewer_id = auth.uid())
  WITH CHECK (reviewer_id = auth.uid());

-- Owners can delete their own reviews.
CREATE POLICY reviews_owner_delete ON public.reviews
  FOR DELETE TO authenticated
  USING (reviewer_id = auth.uid());

-- Note: writes on amenities, organizations, pages, properties, property_schedule,
-- and property_types must use the service_role key (admin tooling). service_role
-- bypasses RLS by default.
