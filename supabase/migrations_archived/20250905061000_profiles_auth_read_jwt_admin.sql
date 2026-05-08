-- Standardize profiles RLS: authenticated-only read + JWT admin overrides

BEGIN;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Remove any prior read policies to avoid conflicts
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated read minimal" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Remove any legacy admin policies that referenced profiles (we replaced them earlier)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;

-- Keep self-CRUD policies consistent (drop and recreate to ensure presence)
DROP POLICY IF EXISTS "Enable insert for authenticated users based on user_id" ON public.profiles;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON public.profiles;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON public.profiles;

-- Authenticated-only read
CREATE POLICY "Authenticated read minimal"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Self CRUD
CREATE POLICY "Enable insert for authenticated users based on user_id"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Enable update for users based on user_id"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Enable delete for users based on user_id"
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (auth.uid() = id);

-- Ensure JWT-based admin helper exists
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

-- Admin overrides (non-recursive)
DROP POLICY IF EXISTS "Admins can view all profiles (jwt)" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile (jwt)" ON public.profiles;

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
