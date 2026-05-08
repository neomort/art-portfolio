-- Fix database permissions for messages table
-- Grant explicit permissions to authenticated role
BEGIN;

-- Grant explicit permissions to authenticated role
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.messages TO authenticated;

-- Also grant to anon role for public access if needed
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON public.messages TO anon;

COMMIT;
