-- Backfill bookings.property_id from proposals -> inquiries so org RLS can authorize org members
BEGIN;

UPDATE public.bookings b
SET property_id = i.property_id
FROM public.proposals pr
JOIN public.inquiries i ON i.id = pr.inquiry_id
WHERE b.proposal_id = pr.id
  AND b.property_id IS NULL;

COMMIT;
