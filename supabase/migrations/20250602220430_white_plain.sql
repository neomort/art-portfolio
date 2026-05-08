/*
  # Add auth trigger for automatic profile creation

  1. New Functions
    - Creates a trigger function to automatically create profiles for new users
    
  2. Security
    - Function runs with security definer to bypass RLS
    - Ensures profiles are created with proper permissions
    
  3. Triggers
    - Adds trigger on auth.users to create profiles automatically
*/

-- Create the function that will handle profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$;

-- Create the trigger on auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();