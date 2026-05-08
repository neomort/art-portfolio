/*
  # Set initial admin user

  1. Data Changes
    - Set the first user in the system as an admin
    - This ensures there's at least one admin user to start with
*/

-- Set the first user as an admin (if there are any users)
UPDATE public.profiles
SET is_admin = true
WHERE id IN (
  SELECT id FROM public.profiles ORDER BY created_at ASC LIMIT 1
);