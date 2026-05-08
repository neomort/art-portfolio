-- Add off_hours_adjustment type to organization_adjustments
-- This will support time-based pricing adjustments for different time periods

-- First, add the new enum value
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'org_adjustment_type'
      AND e.enumlabel = 'off_hours_adjustment'
  ) THEN
    ALTER TYPE "public"."org_adjustment_type" ADD VALUE 'off_hours_adjustment';
  END IF;
END $$;

-- Update the type owner to postgres
ALTER TYPE "public"."org_adjustment_type" OWNER TO "postgres";
