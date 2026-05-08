-- Enable RLS on organization_credit_ledger and add policies
BEGIN;

-- Enable RLS if table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema='public' AND table_name='organization_credit_ledger'
  ) THEN
    EXECUTE 'ALTER TABLE public.organization_credit_ledger ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- SELECT: org members can read their org's ledger; platform admins can read
DROP POLICY IF EXISTS org_credit_ledger_select ON public.organization_credit_ledger;
CREATE POLICY org_credit_ledger_select
ON public.organization_credit_ledger
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = organization_credit_ledger.organization_id
      AND om.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_admin = true
  )
);

-- INSERT: org owners/admins and platform admins can add ledger entries
DROP POLICY IF EXISTS org_credit_ledger_insert ON public.organization_credit_ledger;
CREATE POLICY org_credit_ledger_insert
ON public.organization_credit_ledger
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = organization_credit_ledger.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner','admin')
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_admin = true
  )
);

-- UPDATE: disallow general updates (append-only ledger). If needed, allow platform admin only.
DROP POLICY IF EXISTS org_credit_ledger_update ON public.organization_credit_ledger;
CREATE POLICY org_credit_ledger_update
ON public.organization_credit_ledger
FOR UPDATE TO authenticated
USING (
  false
)
WITH CHECK (
  false
);

-- DELETE: org owners/admins (rare) or platform admins can remove; adjust to 'false' to forbid if truly immutable
DROP POLICY IF EXISTS org_credit_ledger_delete ON public.organization_credit_ledger;
CREATE POLICY org_credit_ledger_delete
ON public.organization_credit_ledger
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = organization_credit_ledger.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner','admin')
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_admin = true
  )
);

COMMIT;
