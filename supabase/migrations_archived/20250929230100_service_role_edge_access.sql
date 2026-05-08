-- Ensure service role can bypass RLS when edge functions query profiles/organizations

-- Profiles: allow service role reads
DROP POLICY IF EXISTS "service role read profiles" ON public.profiles;
CREATE POLICY "service role read profiles"
  ON public.profiles
  FOR SELECT
  TO service_role
  USING (TRUE);

GRANT SELECT ON public.profiles TO service_role;

-- Organizations: allow service role manage access (read/write) for Stripe onboarding
DROP POLICY IF EXISTS "service role manage organizations" ON public.organizations;
CREATE POLICY "service role manage organizations"
  ON public.organizations
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO service_role;
