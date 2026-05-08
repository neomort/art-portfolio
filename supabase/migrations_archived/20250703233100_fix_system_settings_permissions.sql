-- Ensure the system_settings table has the correct permissions
GRANT SELECT ON TABLE public.system_settings TO authenticated, anon;

-- Update the get_system_setting function to be more permissive for auth_email_confirm_enabled
CREATE OR REPLACE FUNCTION public.get_system_setting(setting_key text)
RETURNS text AS $$
DECLARE
  result text;
BEGIN
  -- Always allow access to auth_email_confirm_enabled for everyone
  IF setting_key = 'auth_email_confirm_enabled' THEN
    SELECT value INTO result FROM public.system_settings WHERE key = setting_key LIMIT 1;
    RETURN result;
  END IF;
  
  -- Admin users can access any setting
  IF EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND is_admin = true
  ) THEN
    SELECT value INTO result FROM public.system_settings WHERE key = setting_key;
    RETURN result;
  END IF;
  
  -- Default return null if not authorized
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_system_setting(text) TO public, anon, authenticated;
