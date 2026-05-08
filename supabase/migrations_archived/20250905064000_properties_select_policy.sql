-- Reinstate properties SELECT policy so favorites and browsing can read properties
BEGIN;

-- Allow authenticated users to read properties (adjust to true if public browse is desired)
DROP POLICY IF EXISTS properties_select_all ON public.properties;
CREATE POLICY properties_select_all
  ON public.properties FOR SELECT TO authenticated
  USING (true);

COMMIT;
