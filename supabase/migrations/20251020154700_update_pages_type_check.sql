-- Update pages_type_check constraint to allow new page types
ALTER TABLE public.pages
  DROP CONSTRAINT IF EXISTS pages_type_check;

ALTER TABLE public.pages
  ADD CONSTRAINT pages_type_check
  CHECK (type IN (
    'Support',
    'Legal',
    'News',
    'Information',
    'Documentation',
    'Landing Page',
    'Features'
  ));
