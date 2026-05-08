-- Add IANA timezone to properties and default timezone to organizations

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS iana_timezone text;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS default_timezone text;

-- Optional: no defaults; values will be populated by app logic from lat/lng or set at org level.
