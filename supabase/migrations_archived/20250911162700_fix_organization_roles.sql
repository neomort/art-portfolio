-- Fix organization roles: make new users 'owner' by default and update existing members
BEGIN;

-- Update the trigger to make new organization creators 'owner' instead of 'member'
CREATE OR REPLACE FUNCTION public.add_creator_as_org_owner()
RETURNS TRIGGER AS $$
BEGIN
  -- Add the user who created the organization as an owner
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (NEW.id, auth.uid(), 'owner')
  ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'owner';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update existing 'member' roles to 'owner' for users who are the primary organization member
UPDATE public.organization_members 
SET role = 'owner'
WHERE role = 'member'
AND EXISTS (
  SELECT 1 FROM public.profiles p 
  WHERE p.id = organization_members.user_id 
  AND p.primary_organization_id = organization_members.organization_id
);

-- Update the organization membership trigger function to use 'owner' instead of 'member'
CREATE OR REPLACE FUNCTION public.trg_profiles_ensure_org_membership()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_org_id uuid;
  v_member_exists boolean;
BEGIN
  -- Only proceed if company_name changed and primary_organization_id is null
  IF (TG_OP = 'UPDATE' AND OLD.company_name IS DISTINCT FROM NEW.company_name AND NEW.primary_organization_id IS NULL) 
     OR (TG_OP = 'INSERT' AND NEW.company_name IS NOT NULL AND NEW.primary_organization_id IS NULL) THEN
    
    -- Find or create organization
    select id into v_org_id from public.organizations where lower(name) = lower(NEW.company_name) limit 1;
    if v_org_id is null then
      insert into public.organizations(name, created_at, updated_at)
      values (NEW.company_name, now(), now())
      returning id into v_org_id;
    end if;
    
    -- Ensure membership exists with 'owner' role
    select exists(
      select 1 from public.organization_members om where om.organization_id = v_org_id and om.user_id = NEW.id
    ) into v_member_exists;
    if not v_member_exists then
      insert into public.organization_members(organization_id, user_id, role)
      values (v_org_id, NEW.id, 'owner');
    end if;
    
    -- Set primary_organization_id on NEW row
    NEW.primary_organization_id := v_org_id;
  END IF;
  RETURN NEW;
END $$;

COMMIT;
