/*
  # Set initial admin user

  1. Data Updates
    - Sets the first user in the system as an admin
  2. Security
    - No changes to RLS policies
*/

-- Set the first user as an admin (if there are any users)
UPDATE public.profiles
SET is_admin = true
WHERE id IN (
  SELECT id FROM public.profiles ORDER BY created_at ASC LIMIT 1
);