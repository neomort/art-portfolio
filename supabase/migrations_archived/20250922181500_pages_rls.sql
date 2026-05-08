-- RLS for pages (static pages)
-- Allow all authenticated users to READ
-- Only admins (profiles.is_admin = true) can INSERT/UPDATE/DELETE

begin;

ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.pages TO authenticated;
GRANT ALL ON public.pages TO service_role;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS pages_select ON public.pages;
DROP POLICY IF EXISTS pages_modify ON public.pages;

-- SELECT policy: any authenticated user can read pages
CREATE POLICY pages_select
ON public.pages
FOR SELECT
TO authenticated
USING (true);

-- INSERT/UPDATE/DELETE policy: only admins can modify
CREATE POLICY pages_modify
ON public.pages
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_admin = true
  )
);

commit;
