-- Re-enable RLS on both tables with proper policies
-- Now that database permissions are fixed, we can re-enable security
BEGIN;

-- Enable RLS on messages table
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Enable RLS on inquiries table  
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

-- Messages table policies
DROP POLICY IF EXISTS "Users can insert messages" ON public.messages;
DROP POLICY IF EXISTS "Users can view messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update messages" ON public.messages;
DROP POLICY IF EXISTS "Users can delete messages" ON public.messages;

CREATE POLICY "Users can insert messages"
ON public.messages
FOR INSERT TO authenticated
WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Users can view messages"
ON public.messages
FOR SELECT TO authenticated
USING (
  sender_id = auth.uid() OR
  inquiry_id IN (
    SELECT id FROM public.inquiries WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update messages"
ON public.messages
FOR UPDATE TO authenticated
USING (sender_id = auth.uid())
WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Users can delete messages"
ON public.messages
FOR DELETE TO authenticated
USING (sender_id = auth.uid());

-- Inquiries table policies
DROP POLICY IF EXISTS "Users can insert their own inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Users can view their own inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Users can update their own inquiries" ON public.inquiries;

CREATE POLICY "Users can insert their own inquiries"
ON public.inquiries
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view their own inquiries"
ON public.inquiries
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can update their own inquiries"
ON public.inquiries
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

COMMIT;
