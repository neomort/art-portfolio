-- Fix database permissions for sent_notifications table
-- Grant explicit permissions to authenticated role
BEGIN;

-- Grant explicit permissions to authenticated role
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.sent_notifications TO authenticated;

-- Also grant to anon role for public access if needed
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON public.sent_notifications TO anon;

COMMIT;
