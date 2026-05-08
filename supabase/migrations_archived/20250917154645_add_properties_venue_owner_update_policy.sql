-- Add venue owner UPDATE policy for properties
-- This allows venue owners to update their own properties including neighborhood and metro_area

DO $$
BEGIN
  CREATE POLICY properties_update_venue_owner
    ON public.properties
    FOR UPDATE
    TO authenticated
    USING (venue_id = auth.uid())
    WITH CHECK (venue_id = auth.uid());
EXCEPTION
  WHEN duplicate_object THEN
    -- Policy already exists; ignore to keep migration idempotent
    NULL;
END $$;
