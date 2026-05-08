-- Enable RLS and create policies for sent_notifications table
BEGIN;

-- Enable RLS on sent_notifications table
ALTER TABLE public.sent_notifications ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "Users can insert sent_notifications" ON public.sent_notifications;
DROP POLICY IF EXISTS "Users can view sent_notifications" ON public.sent_notifications;
DROP POLICY IF EXISTS "Users can update sent_notifications" ON public.sent_notifications;
DROP POLICY IF EXISTS "Users can delete sent_notifications" ON public.sent_notifications;

-- Create INSERT policy - users can insert their own sent notifications
CREATE POLICY "Users can insert sent_notifications"
ON public.sent_notifications
FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Create SELECT policy - users can view their own sent notifications
CREATE POLICY "Users can view sent_notifications"
ON public.sent_notifications
FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

-- Create UPDATE policy - users can update their own sent notifications
CREATE POLICY "Users can update sent_notifications"
ON public.sent_notifications
FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Create DELETE policy - users can delete their own sent notifications
CREATE POLICY "Users can delete sent_notifications"
ON public.sent_notifications
FOR DELETE TO authenticated
USING (auth.uid() IS NOT NULL);

COMMIT;
