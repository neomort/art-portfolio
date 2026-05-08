-- Fix the RPC function to avoid ambiguous column reference
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
  RETURN QUERY INSERT INTO public.profiles (
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
    profiles.id,
    profiles.email,
    profiles.full_name,
    profiles.password_set,
    profiles.invited_via_proposal_id;
END;
$$;
