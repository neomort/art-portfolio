-- Auto-create a public.profiles row whenever a new auth.users row is created
-- Idempotent and safe to run multiple times

BEGIN;

-- Ensure helper: set_updated_at exists (no-op if already present)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the handler function that inserts a profile on new auth.users
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_full_name text;
BEGIN
  -- Extract a friendly name if present in raw_user_meta_data
  BEGIN
    v_full_name := COALESCE((NEW.raw_user_meta_data ->> 'full_name'), split_part(COALESCE(NEW.email,''), '@', 1));
  EXCEPTION WHEN OTHERS THEN
    v_full_name := split_part(COALESCE(NEW.email,''), '@', 1);
  END;

  -- Insert profile if it does not already exist
  INSERT INTO public.profiles (id, email, full_name, created_at, updated_at)
  VALUES (NEW.id, NEW.email, v_full_name, now(), now())
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Create trigger on auth.users if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = 'trg_auth_users_after_insert_profile'
      AND n.nspname = 'auth'
      AND c.relname = 'users'
  ) THEN
    CREATE TRIGGER trg_auth_users_after_insert_profile
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
  END IF;
END $$;

COMMIT;
