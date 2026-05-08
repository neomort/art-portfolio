-- RLS for system_settings so ONLY admins can read/update
-- Also ensure profiles has a self-select policy so admin check works in RLS predicates

begin;

-- Ensure RLS is on
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Base grants (RLS still applies)
GRANT SELECT, UPDATE ON public.system_settings TO authenticated;
GRANT ALL ON public.system_settings TO service_role;

-- Clean up old policies if any
DROP POLICY IF EXISTS system_settings_select_admin ON public.system_settings;
DROP POLICY IF EXISTS system_settings_update_admin ON public.system_settings;

-- SELECT: only admins can read settings
CREATE POLICY system_settings_select_admin
ON public.system_settings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_admin = true
  )
);

-- UPDATE: only admins can update settings
CREATE POLICY system_settings_update_admin
ON public.system_settings
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_admin = true
  )
);

-- Ensure profiles has a self-select policy so the admin check above can be evaluated
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.profiles TO authenticated;
DROP POLICY IF EXISTS profiles_select_self ON public.profiles;
CREATE POLICY profiles_select_self
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

commit;
