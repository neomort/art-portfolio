-- This migration adds the auth_email_confirm_enabled setting
-- It runs after the system_settings table is created

-- Insert the auth_email_confirm_enabled setting if it doesn't exist
INSERT INTO public.system_settings (key, value, created_at, updated_at)
VALUES ('auth_email_confirm_enabled', 'true', now(), now())
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = EXCLUDED.updated_at;
