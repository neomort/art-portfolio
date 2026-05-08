-- RLS for FAQ tables
-- Allow all authenticated users to read, only admins can write

begin;

ALTER TABLE public.faq_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faq_entries ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.faq_categories TO authenticated;
GRANT SELECT ON public.faq_entries TO authenticated;
GRANT ALL ON public.faq_categories TO service_role;
GRANT ALL ON public.faq_entries TO service_role;

-- Drop any existing policies to avoid conflicts
DROP POLICY IF EXISTS faq_categories_select ON public.faq_categories;
DROP POLICY IF EXISTS faq_categories_modify ON public.faq_categories;
DROP POLICY IF EXISTS faq_entries_select ON public.faq_entries;
DROP POLICY IF EXISTS faq_entries_modify ON public.faq_entries;

-- SELECT: any authenticated user can read FAQs
CREATE POLICY faq_categories_select
ON public.faq_categories
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY faq_entries_select
ON public.faq_entries
FOR SELECT
TO authenticated
USING (true);

-- INSERT/UPDATE/DELETE: only admins
CREATE POLICY faq_categories_modify
ON public.faq_categories
FOR ALL
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

CREATE POLICY faq_entries_modify
ON public.faq_entries
FOR ALL
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
