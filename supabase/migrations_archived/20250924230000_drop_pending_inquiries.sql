-- Drop legacy pending_inquiries flow (table and helper RPCs)

-- Best-effort: drop RPCs if they exist
-- adjust schema name if different
DO $$ BEGIN
  PERFORM 1
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.proname = 'mark_pending_inquiry_claimed' AND n.nspname = 'public';
  IF FOUND THEN
    EXECUTE 'drop function public.mark_pending_inquiry_claimed(p_token text, p_user_id uuid, p_inquiry_id uuid)';
  END IF;
EXCEPTION WHEN others THEN
  -- ignore
END $$;

-- Drop table if exists
DROP TABLE IF EXISTS public.pending_inquiries CASCADE;
