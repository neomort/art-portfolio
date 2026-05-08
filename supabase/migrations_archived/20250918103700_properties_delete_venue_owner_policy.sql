-- Allow venue owners to delete their own properties (idempotent)
DO $$
BEGIN
  CREATE POLICY properties_delete_venue_owner
    ON public.properties
    FOR DELETE
    TO authenticated
    USING (venue_id = auth.uid());
EXCEPTION
  WHEN duplicate_object THEN
    -- Policy already exists; ignore to keep migration idempotent
    NULL;
END $$;
