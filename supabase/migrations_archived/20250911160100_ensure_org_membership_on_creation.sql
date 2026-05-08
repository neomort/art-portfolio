-- Ensure users are automatically added as members when they create organizations
-- This fixes the issue where new users can't create properties because they're not in organization_members

BEGIN;

-- Create a trigger function to automatically add the creator as an owner when an organization is created
CREATE OR REPLACE FUNCTION public.add_creator_as_org_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Add the user who created the organization as an owner
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (NEW.id, auth.uid(), 'owner')
  ON CONFLICT (organization_id, user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trg_add_creator_as_org_owner ON public.organizations;

-- Create trigger to fire after organization insert
CREATE TRIGGER trg_add_creator_as_org_owner
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.add_creator_as_org_owner();

-- Also create a function to manually fix existing organizations without proper membership
CREATE OR REPLACE FUNCTION public.fix_missing_org_memberships()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Add missing memberships for organization creators
  INSERT INTO public.organization_members (organization_id, user_id, role)
  SELECT DISTINCT 
    o.id as organization_id,
    p.id as user_id,
    'owner' as role
  FROM public.organizations o
  JOIN public.profiles p ON p.primary_organization_id = o.id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.organization_members om 
    WHERE om.organization_id = o.id AND om.user_id = p.id
  );
END;
$$;

-- Run the fix function to handle existing data
SELECT public.fix_missing_org_memberships();

COMMIT;
