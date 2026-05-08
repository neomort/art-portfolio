-- Add field to track proposal invitations for temporary users
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS invited_via_proposal_id uuid REFERENCES proposals(id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_invited_via_proposal_id ON profiles(invited_via_proposal_id);
