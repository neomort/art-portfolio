-- Create RPC function to get user display names from auth.users
-- This function bypasses RLS to access auth.users for guest email lookups

CREATE OR REPLACE FUNCTION get_user_display_name(email_to_check TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_display_name TEXT;
BEGIN
  -- Only allow authenticated users to use this function
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Get display name from auth.users metadata
  -- Try full_name first, then name, then fall back to email prefix
  SELECT COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', split_part(email, '@', 1))
  INTO user_display_name
  FROM auth.users 
  WHERE email = lower(email_to_check);
  
  RETURN user_display_name;
EXCEPTION
  WHEN OTHERS THEN
    -- Return NULL for any errors (user not found, etc.)
    RETURN NULL;
END;
$$;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION get_user_display_name TO authenticated;
