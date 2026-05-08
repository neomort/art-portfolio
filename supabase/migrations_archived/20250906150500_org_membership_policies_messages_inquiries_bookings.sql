-- Make inquiries/messages/proposals/bookings RLS org-aware using properties.organization_id and organization_members
BEGIN;

-- Inquiries: participants (requester) OR org members (owner/admin/member on property's org) can read
DROP POLICY IF EXISTS "Participants can read inquiries" ON public.inquiries;
CREATE POLICY "Participants or org members can read inquiries"
ON public.inquiries
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = inquiries.property_id
      AND (
        p.venue_id = auth.uid()
        OR (
          p.organization_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = p.organization_id AND om.user_id = auth.uid()
          )
        )
      )
  )
);

-- Messages: participants or org members can read
DROP POLICY IF EXISTS "Participants can read messages" ON public.messages;
CREATE POLICY "Participants or org members can read messages"
ON public.messages
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.inquiries i
    JOIN public.properties p ON p.id = i.property_id
    WHERE i.id = messages.inquiry_id
      AND (
        i.user_id = auth.uid()
        OR p.venue_id = auth.uid()
        OR (
          p.organization_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = p.organization_id AND om.user_id = auth.uid()
          )
        )
      )
  )
);

-- Messages: participants or org members can send (insert)
DROP POLICY IF EXISTS "Participants can send messages" ON public.messages;
CREATE POLICY "Participants or org members can send messages"
ON public.messages
FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.inquiries i
    JOIN public.properties p ON p.id = i.property_id
    WHERE i.id = messages.inquiry_id
      AND (
        i.user_id = auth.uid()
        OR p.venue_id = auth.uid()
        OR (
          p.organization_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = p.organization_id AND om.user_id = auth.uid()
          )
        )
      )
  )
);

-- Proposals: participants or org members can read
DROP POLICY IF EXISTS "Participants can read proposals for their inquiries" ON public.proposals;
CREATE POLICY "Participants or org members can read proposals"
ON public.proposals
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.inquiries i
    JOIN public.properties p ON p.id = i.property_id
    WHERE i.id = proposals.inquiry_id
      AND (
        i.user_id = auth.uid()
        OR p.venue_id = auth.uid()
        OR (
          p.organization_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = p.organization_id AND om.user_id = auth.uid()
          )
        )
      )
  )
);

-- Bookings: booker OR org members for the property's org can read
-- If a policy already exists for bookings, replace it; otherwise create a new one.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='bookings'
  ) THEN
    DROP POLICY IF EXISTS "Booker or venue can read bookings" ON public.bookings;
    DROP POLICY IF EXISTS "bookings_read" ON public.bookings;

    CREATE POLICY "Booker or org members can read bookings"
    ON public.bookings
    FOR SELECT TO authenticated
    USING (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.properties p
        WHERE p.id = bookings.property_id
          AND (
            p.venue_id = auth.uid()
            OR (
              p.organization_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM public.organization_members om
                WHERE om.organization_id = p.organization_id AND om.user_id = auth.uid()
              )
            )
          )
      )
    );
  END IF;
END $$;

COMMIT;
