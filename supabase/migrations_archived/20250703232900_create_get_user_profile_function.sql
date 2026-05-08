-- Create a secure function to get user profile data with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.get_user_profile(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  full_name text,
  company_name text,
  phone text,
  avatar_url text,
  business_type text,
  email text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT 
    id,
    full_name,
    company_name,
    phone,
    avatar_url,
    business_type,
    email,
    created_at,
    updated_at
  FROM public.profiles
  WHERE id = $1;
$func$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_profile(uuid) TO authenticated;
