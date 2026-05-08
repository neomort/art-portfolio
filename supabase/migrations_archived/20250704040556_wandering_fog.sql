/*
  # Add sent_notifications table for email idempotency

  1. New Tables
    - `sent_notifications` - Tracks sent email notifications to prevent duplicates
      - `id` (uuid, primary key)
      - `request_id` (text, unique)
      - `email_type` (text)
      - `recipient_email` (text)
      - `created_at` (timestamp)
  
  2. Security
    - Enable RLS on `sent_notifications` table
    - Add policy for authenticated users to insert records
    - Add policy for authenticated users to view their records
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
CREATE POLICY "Service can insert sent_notifications"
  ON public.sent_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create policy for viewing notifications
CREATE POLICY "Service can view sent_notifications"
  ON public.sent_notifications
  FOR SELECT
  TO authenticated
  USING (true);

-- Create index on request_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_sent_notifications_request_id ON public.sent_notifications(request_id);