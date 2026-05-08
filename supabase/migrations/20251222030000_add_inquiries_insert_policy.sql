-- Add missing INSERT policy for inquiries table
-- This allows authenticated users to insert their own inquiries
BEGIN;

-- Create INSERT policy for inquiries - users can insert their own inquiries
CREATE POLICY "Users can insert their own inquiries" 
ON public.inquiries 
FOR INSERT TO authenticated 
WITH CHECK (user_id = auth.uid());

COMMIT;
