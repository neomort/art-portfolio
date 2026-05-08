-- Create RPC function that doesn't require auth.users foreign key
-- We'll use the venue owner's ID temporarily and update later
CREATE OR REPLACE FUNCTION create_guest_profile(
  guest_email TEXT,
  guest_name TEXT,
  temp_proposal_id UUID,
  venue_owner_id UUID
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
DECLARE
  new_profile_id UUID;
BEGIN
  -- Generate a new UUID for the guest profile
  new_profile_id := gen_random_uuid();
  
  -- Insert the guest profile using venue owner's ID to satisfy foreign key
  -- We'll update this later when the guest creates their account
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    password_set,
    invited_via_proposal_id,
    created_at,
    updated_at
  ) VALUES (
    new_profile_id,
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
    profiles.invited_via_proposal_id
  INTO new_profile_id, guest_email, guest_name, password_set, invited_via_proposal_id;
  
  -- Return the created profile
  RETURN QUERY SELECT 
    new_profile_id as id,
    guest_email as email,
    guest_name as full_name,
    false as password_set,
    temp_proposal_id as invited_via_proposal_id;
END;
$$;
