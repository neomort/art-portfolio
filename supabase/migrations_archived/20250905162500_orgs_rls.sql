-- RLS policies for organizations based on profiles.primary_organization_id membership
BEGIN;

-- Enable RLS on organizations (idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'organizations'
  ) THEN
    EXECUTE 'ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY';
  ELSE
    RAISE NOTICE 'Table public.organizations not found; skipping org RLS migration.';
  END IF;
END $$;

-- Create SELECT policy if missing
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'organizations'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'organizations' AND policyname = 'orgs_select_member_or_admin'
    ) THEN
      EXECUTE '
        CREATE POLICY orgs_select_member_or_admin
        ON public.organizations
        FOR SELECT
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND (p.primary_organization_id = organizations.id OR p.is_admin = true)
          )
        )
      ';
    END IF;
  END IF;
END $$;

-- Create UPDATE policy if missing
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'organizations'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'organizations' AND policyname = 'orgs_update_member_or_admin'
    ) THEN
      EXECUTE '
        CREATE POLICY orgs_update_member_or_admin
        ON public.organizations
        FOR UPDATE
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND (p.primary_organization_id = organizations.id OR p.is_admin = true)
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND (p.primary_organization_id = organizations.id OR p.is_admin = true)
          )
        )
      ';
    END IF;
  END IF;
END $$;

-- Note: INSERT/DELETE remain restricted to service_role/admin RPCs.

COMMIT;
