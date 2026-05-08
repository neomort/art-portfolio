-- Create organization_member_invites to allow adding by email without creating Auth users
BEGIN;

CREATE TABLE IF NOT EXISTS public.organization_member_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('owner','admin','member')),
  invited_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  accepted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, email)
);

-- Basic RLS: only authenticated; org admins/owners can manage invites of their org; invitee can view own by email if logged-in email matches
ALTER TABLE public.organization_member_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_member_invites_select ON public.organization_member_invites;
CREATE POLICY org_member_invites_select
  ON public.organization_member_invites FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_member_invites.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner','admin')
    )
    OR (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND lower(p.email) = lower(organization_member_invites.email)
      )
    )
  );

DROP POLICY IF EXISTS org_member_invites_modify ON public.organization_member_invites;
CREATE POLICY org_member_invites_modify
  ON public.organization_member_invites FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_member_invites.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner','admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_member_invites.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner','admin')
    )
  );

CREATE INDEX IF NOT EXISTS idx_org_member_invites_org ON public.organization_member_invites(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_member_invites_email ON public.organization_member_invites(lower(email));

COMMIT;
