-- Fix RLS policies for inquiries table
-- Ensure INSERT policy exists and is properly configured
BEGIN;

-- Drop any existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can insert their own inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Users can view their own inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Users can update their own inquiries" ON public.inquiries;

-- Enable RLS on inquiries table
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

-- Create INSERT policy for inquiries - users can insert their own inquiries
CREATE POLICY "Users can insert their own inquiries"
ON public.inquiries
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Create SELECT policy for inquiries - users can view their own inquiries
CREATE POLICY "Users can view their own inquiries"
ON public.inquiries
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Create UPDATE policy for inquiries - users can update their own inquiries
CREATE POLICY "Users can update their own inquiries"
ON public.inquiries
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

COMMIT;
