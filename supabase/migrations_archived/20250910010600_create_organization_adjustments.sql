-- Create organization_adjustments to store discounts & surcharges at the organization level
-- This table is intentionally generic, storing a typed JSON payload per adjustment

-- Enum for adjustment type
DO $$ BEGIN
  CREATE TYPE org_adjustment_type AS ENUM (
    'user_selected_discount',
    'capacity_surcharge',
    'off_hours_adjustment',
    'off_days_adjustment'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Enum for per-unit used by capacity surcharge
DO $$ BEGIN
  CREATE TYPE per_unit AS ENUM (
    'per_hour',
    'per_day',
    'per_week',
    'per_month',
    'per_booking'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Main table
CREATE TABLE IF NOT EXISTS public.organization_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  type org_adjustment_type NOT NULL,
  -- free-form payload, validated in app for now
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Helpful index for queries by organization and ordering
CREATE INDEX IF NOT EXISTS idx_org_adjustments_org ON public.organization_adjustments(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_adjustments_org_sort ON public.organization_adjustments(organization_id, sort_order);

-- Row Level Security (optional; mirror organizations)
ALTER TABLE public.organization_adjustments ENABLE ROW LEVEL SECURITY;

-- Allow org members to read their org adjustments; owners/admins can write via policies you already use
DO $$ BEGIN
  CREATE POLICY "org_adjustments_select" ON public.organization_adjustments
    FOR SELECT
    USING (
      -- simplistic: any authenticated user can read; tighten later with a join to organization_members
      auth.role() = 'authenticated'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Ensure the timestamp trigger function exists (idempotent)
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS trigger AS $func$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

-- Create the trigger; ignore duplicate creation attempts
DO $$ BEGIN
  CREATE TRIGGER set_timestamp
  BEFORE UPDATE ON public.organization_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_timestamp();
EXCEPTION WHEN duplicate_object THEN
  -- Trigger already exists; do nothing
  NULL;
END $$;
