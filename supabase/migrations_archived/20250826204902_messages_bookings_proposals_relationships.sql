-- Migration: Establish relationships and RLS for bookings/messages/proposals and related tables
-- Created by Cascade on 2025-08-26 20:49:02 UTC-06

-- =============================
-- Foreign Keys & Indexes
-- =============================

-- 1) bookings.proposal_id -> proposals.id (named exactly bookings_proposal_id_fkey)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'bookings' AND c.conname = 'bookings_proposal_id_fkey'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_proposal_id_fkey
      FOREIGN KEY (proposal_id) REFERENCES public.proposals(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bookings_proposal_id ON public.bookings(proposal_id);

-- Try to validate; if data is not clean, keep NOT VALID and continue
-- DO $$
-- BEGIN
--   BEGIN
--     EXECUTE 'ALTER TABLE public.bookings VALIDATE CONSTRAINT bookings_proposal_id_fkey';
--   EXCEPTION WHEN OTHERS THEN
--     RAISE NOTICE 'Could not validate bookings_proposal_id_fkey now; leaving NOT VALID';
--   END;
-- END $$;


-- 2) messages.inquiry_id -> inquiries.id (named exactly messages_inquiry_id_fkey)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'messages' AND c.conname = 'messages_inquiry_id_fkey'
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_inquiry_id_fkey
      FOREIGN KEY (inquiry_id) REFERENCES public.inquiries(id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_messages_inquiry_id ON public.messages(inquiry_id);

-- DO $$
-- BEGIN
--   BEGIN
--     EXECUTE 'ALTER TABLE public.messages VALIDATE CONSTRAINT messages_inquiry_id_fkey';
--   EXCEPTION WHEN OTHERS THEN
--     RAISE NOTICE 'Could not validate messages_inquiry_id_fkey now; leaving NOT VALID';
--   END;
-- END $$;


-- 3) proposals.inquiry_id -> inquiries.id (named exactly proposals_inquiry_id_fkey)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'proposals' AND c.conname = 'proposals_inquiry_id_fkey'
  ) THEN
    ALTER TABLE public.proposals
      ADD CONSTRAINT proposals_inquiry_id_fkey
      FOREIGN KEY (inquiry_id) REFERENCES public.inquiries(id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_proposals_inquiry_id ON public.proposals(inquiry_id);

-- DO $$
-- BEGIN
--   BEGIN
--     EXECUTE 'ALTER TABLE public.proposals VALIDATE CONSTRAINT proposals_inquiry_id_fkey';
--   EXCEPTION WHEN OTHERS THEN
--     RAISE NOTICE 'Could not validate proposals_inquiry_id_fkey now; leaving NOT VALID';
--   END;
-- END $$;


-- =============================
-- Row Level Security (RLS)
-- =============================

-- Enable RLS (intentionally omitted on first apply to avoid behavior changes)

-- Inquiries: participants can read
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='inquiries'
      AND policyname='Participants can read inquiries'
  ) THEN
    CREATE POLICY "Participants can read inquiries"
    ON public.inquiries
    FOR SELECT TO authenticated
    USING (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.properties p
        WHERE p.id = inquiries.property_id AND p.venue_id = auth.uid()
      )
    );
  END IF;
END $$;

-- Messages: participants can read
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='messages'
      AND policyname='Participants can read messages'
  ) THEN
    CREATE POLICY "Participants can read messages"
    ON public.messages
    FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.inquiries i
        WHERE i.id = messages.inquiry_id
          AND (
            i.user_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.properties p
              WHERE p.id = i.property_id AND p.venue_id = auth.uid()
            )
          )
      )
    );
  END IF;
END $$;

-- Messages: participants can send
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='messages'
      AND policyname='Participants can send messages'
  ) THEN
    CREATE POLICY "Participants can send messages"
    ON public.messages
    FOR INSERT TO authenticated
    WITH CHECK (
      sender_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.inquiries i
        WHERE i.id = messages.inquiry_id
          AND (
            i.user_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.properties p
              WHERE p.id = i.property_id AND p.venue_id = auth.uid()
            )
          )
      )
    );
  END IF;
END $$;

-- Proposals: participants can read proposals for their inquiries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='proposals'
      AND policyname='Participants can read proposals for their inquiries'
  ) THEN
    CREATE POLICY "Participants can read proposals for their inquiries"
    ON public.proposals
    FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.inquiries i
        WHERE i.id = proposals.inquiry_id
          AND (
            i.user_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.properties p
              WHERE p.id = i.property_id AND p.venue_id = auth.uid()
            )
          )
      )
    );
  END IF;
END $$;

-- Profiles: allow reading counterpart profiles in conversations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='profiles'
      AND policyname='Allow reading counterpart profiles in conversations'
  ) THEN
    CREATE POLICY "Allow reading counterpart profiles in conversations"
    ON public.profiles
    FOR SELECT TO authenticated
    USING (
      id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.inquiries i
        JOIN public.properties pr ON pr.id = i.property_id
        WHERE
          (profiles.id = i.user_id AND (i.user_id = auth.uid() OR pr.venue_id = auth.uid()))
          OR (profiles.id = pr.venue_id AND (i.user_id = auth.uid() OR pr.venue_id = auth.uid()))
      )
    );
  END IF;
END $$;

-- =============================
-- End of migration
-- =============================
