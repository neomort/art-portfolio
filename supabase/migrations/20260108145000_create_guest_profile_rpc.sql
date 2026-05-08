-- Create RPC function to create guest profiles with elevated privileges
CREATE OR REPLACE FUNCTION create_guest_profile(
  profile_id UUID,
  guest_email TEXT,
  guest_name TEXT,
  temp_proposal_id UUID
)
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  password_set BOOLEAN,
  invited_via_proposal_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert the guest profile with elevated privileges (bypasses RLS)
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    password_set,
    invited_via_proposal_id,
    created_at,
    updated_at
  ) VALUES (
    profile_id,
    guest_email,
    guest_name,
    false, -- password_set = false for temporary user
    temp_proposal_id,
    NOW(),
    NOW()
  )
  RETURNING 
    id,
    email,
    full_name,
    password_set,
    invited_via_proposal_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_guest_profile TO authenticated;
