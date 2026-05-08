-- Create a secure function to get system settings
CREATE OR REPLACE FUNCTION public.get_system_setting(setting_key text)
RETURNS text AS $$
DECLARE
  result text;
BEGIN
  -- Only allow access to specific settings for non-admin users
  IF setting_key = 'auth_email_confirm_enabled' THEN
    SELECT value INTO result FROM public.system_settings WHERE key = setting_key;
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

-- Grant execute permissions to all users
GRANT EXECUTE ON FUNCTION public.get_system_setting(text) TO public, anon, authenticated;
