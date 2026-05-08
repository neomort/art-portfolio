-- Fix RLS policies for messages table
-- Ensure proper INSERT, SELECT, UPDATE policies for messages
BEGIN;

-- Drop any existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can insert messages" ON public.messages;
DROP POLICY IF EXISTS "Users can view messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update messages" ON public.messages;
DROP POLICY IF EXISTS "Users can delete messages" ON public.messages;

-- Enable RLS on messages table
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Create INSERT policy for messages - users can insert messages they are involved in
CREATE POLICY "Users can insert messages"
ON public.messages
FOR INSERT TO authenticated
WITH CHECK (
  -- Users can insert messages they are sending (sender_id = auth.uid())
  sender_id = auth.uid() OR
  -- Or messages for inquiries they own (inquiry.user_id = auth.uid())
  (inquiry_id IN (
    SELECT id FROM public.inquiries WHERE user_id = auth.uid()
  ))
);

-- Create SELECT policy for messages - users can view messages they are involved in
CREATE POLICY "Users can view messages"
ON public.messages
FOR SELECT TO authenticated
USING (
  -- Users can view messages they sent
  sender_id = auth.uid() OR
  -- Or messages for inquiries they own
  (inquiry_id IN (
    SELECT id FROM public.inquiries WHERE user_id = auth.uid()
  ))
);

-- Create UPDATE policy for messages - users can update their own messages
CREATE POLICY "Users can update messages"
ON public.messages
FOR UPDATE TO authenticated
USING (sender_id = auth.uid())
WITH CHECK (sender_id = auth.uid());

-- Create DELETE policy for messages - users can delete their own messages
CREATE POLICY "Users can delete messages"
ON public.messages
FOR DELETE TO authenticated
USING (sender_id = auth.uid());

COMMIT;
