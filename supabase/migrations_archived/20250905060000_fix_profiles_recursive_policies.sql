-- Fix recursive RLS policies on profiles by removing self-referential admin checks
-- and replacing them with a JWT-claim-based helper that does not touch profiles.

BEGIN;

-- Ensure RLS is enabled on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop recursive admin policies if they exist
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;

-- Create a stable helper that reads the is_admin flag from JWT claims
-- This avoids querying public.profiles within a profiles policy.
CREATE OR REPLACE FUNCTION public.auth_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  select coalesce(
    (current_setting('request.jwt.claims', true)::jsonb ->> 'is_admin')::boolean,
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.auth_is_admin() TO anon, authenticated;

-- Recreate safe admin policies using the JWT-based helper
CREATE POLICY "Admins can view all profiles (jwt)"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.auth_is_admin());

CREATE POLICY "Admins can update any profile (jwt)"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

COMMIT;
