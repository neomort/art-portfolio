-- Optimize the 'Admins can delete pages' RLS policy by moving auth check to a scalar subquery
-- This prevents per-row evaluation of auth.uid() and improves performance

-- Create a helper function to check admin status
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_admin FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Drop and recreate the policy to use the scalar subquery
DO $$
BEGIN
  -- Drop the old policy if it exists
  DROP POLICY IF EXISTS "Admins can delete pages" ON public.pages;
  
  -- Create the optimized policy
  EXECUTE format('CREATE POLICY "Admins can delete pages" 
    ON public.pages
    FOR DELETE 
    TO authenticated
    USING ((SELECT is_admin()));');
    
  RAISE NOTICE 'Successfully updated "Admins can delete pages" policy to use scalar subquery';
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error updating policy: %', SQLERRM;
END $$;

-- Grant execute on the function to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
