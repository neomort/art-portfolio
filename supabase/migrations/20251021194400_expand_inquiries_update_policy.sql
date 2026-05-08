-- Allow org members to archive/unarchive inquiries by updating initiator/responder flags
BEGIN;

DROP POLICY IF EXISTS "Allow inquiry and property owner updates" ON public.inquiries;

CREATE POLICY "Allow inquiry participants or org members to update"
  ON public.inquiries
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.properties p
      WHERE p.id = inquiries.property_id
        AND (
          p.venue_id = auth.uid()
          OR (
            p.organization_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM public.organization_members om
              WHERE om.organization_id = p.organization_id
                AND om.user_id = auth.uid()
                AND om.role IN ('owner','admin','member')
            )
          )
        )
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.properties p
      WHERE p.id = inquiries.property_id
        AND (
          p.venue_id = auth.uid()
          OR (
            p.organization_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM public.organization_members om
              WHERE om.organization_id = p.organization_id
                AND om.user_id = auth.uid()
                AND om.role IN ('owner','admin','member')
            )
          )
        )
    )
  );

COMMIT;
