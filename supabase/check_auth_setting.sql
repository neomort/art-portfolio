-- Check if auth_email_confirm_enabled setting exists and its value
SELECT key, value, created_at, updated_at 
FROM public.system_settings 
WHERE key = 'auth_email_confirm_enabled';
