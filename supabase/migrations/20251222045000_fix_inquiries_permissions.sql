-- Fix database permissions for inquiries table
-- Grant explicit permissions to authenticated role
BEGIN;

-- Grant explicit permissions to authenticated role
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.inquiries TO authenticated;

-- Also grant to anon role for public access if needed
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON public.inquiries TO anon;

COMMIT;
