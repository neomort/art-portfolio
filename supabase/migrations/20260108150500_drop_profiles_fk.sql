-- Drop the foreign key constraint that prevents creating profiles without auth users
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
