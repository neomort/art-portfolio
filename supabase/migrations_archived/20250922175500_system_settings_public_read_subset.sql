-- Allow authenticated users to SELECT a safe subset of system_settings keys
-- Keep UPDATE restricted to admins only (from previous migration)

begin;

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.system_settings TO authenticated;

-- Drop prior select policy to replace with more granular ones
DROP POLICY IF EXISTS system_settings_select_admin ON public.system_settings;

-- SELECT: allow all authenticated users to read a safe subset of keys used by general UI
CREATE POLICY system_settings_select_safe_subset
ON public.system_settings
FOR SELECT
TO authenticated
USING (
  key IN (
    'email_sender',
    'auth_email_confirm_enabled'
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_admin = true
  )
);

commit;
