-- Simplify RLS policies for messages table
-- Use simpler logic that should work reliably
BEGIN;

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can insert messages" ON public.messages;
DROP POLICY IF EXISTS "Users can view messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update messages" ON public.messages;
DROP POLICY IF EXISTS "Users can delete messages" ON public.messages;

-- Enable RLS on messages table
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Simple INSERT policy - users can insert messages if they are the sender
CREATE POLICY "Users can insert messages"
ON public.messages
FOR INSERT TO authenticated
WITH CHECK (sender_id = auth.uid());

-- Simple SELECT policy - users can view messages they sent or messages for inquiries they own
CREATE POLICY "Users can view messages"
ON public.messages
FOR SELECT TO authenticated
USING (
  sender_id = auth.uid() OR
  inquiry_id IN (
    SELECT id FROM public.inquiries WHERE user_id = auth.uid()
  )
);

-- Simple UPDATE policy - users can update their own messages
CREATE POLICY "Users can update messages"
ON public.messages
FOR UPDATE TO authenticated
USING (sender_id = auth.uid())
WITH CHECK (sender_id = auth.uid());

-- Simple DELETE policy - users can delete their own messages
CREATE POLICY "Users can delete messages"
ON public.messages
FOR DELETE TO authenticated
USING (sender_id = auth.uid());

COMMIT;
