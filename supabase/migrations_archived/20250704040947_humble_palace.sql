/*
  # Fix sent_notifications table creation

  1. New Tables
    - Ensures `sent_notifications` table exists for tracking sent emails
    - Adds unique constraint on request_id to prevent duplicates
    - Adds index for faster lookups
  
  2. Security
    - Enables RLS on the table
    - Adds policies for insert and select operations
    - Uses conditional creation to avoid errors if policies already exist
*/

-- Create sent_notifications table for tracking sent emails
CREATE TABLE IF NOT EXISTS public.sent_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id text UNIQUE NOT NULL,
  email_type text NOT NULL,
  recipient_email text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.sent_notifications ENABLE ROW LEVEL SECURITY;

-- Create policy for inserting notifications (service role will handle this)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'sent_notifications' 
    AND policyname = 'Service can insert sent_notifications'
  ) THEN
    CREATE POLICY "Service can insert sent_notifications"
      ON public.sent_notifications
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

-- Create policy for viewing notifications
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'sent_notifications' 
    AND policyname = 'Service can view sent_notifications'
  ) THEN
    CREATE POLICY "Service can view sent_notifications"
      ON public.sent_notifications
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- Create index on request_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_sent_notifications_request_id ON public.sent_notifications(request_id);