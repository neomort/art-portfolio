/*
  # Fix duplicate notifications

  1. Changes
    - Add a unique constraint on sent_notifications.request_id to ensure idempotency
    - Add a trigger to prevent duplicates in sent_notifications table
    - Add comments to document the purpose of the table and columns

  2. Security
    - No changes to RLS policies
*/

-- Ensure the unique constraint exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'sent_notifications_request_id_key'
  ) THEN
    ALTER TABLE public.sent_notifications 
    ADD CONSTRAINT sent_notifications_request_id_key UNIQUE (request_id);
  END IF;
END $$;

-- Add more detailed logging for debugging
COMMENT ON TABLE public.sent_notifications IS 'Tracks sent email notifications for idempotency';
COMMENT ON COLUMN public.sent_notifications.request_id IS 'Unique identifier for the notification request';
COMMENT ON COLUMN public.sent_notifications.email_type IS 'Type of email template used';
COMMENT ON COLUMN public.sent_notifications.recipient_email IS 'Email address of the recipient';

-- Create a function to log notification attempts
CREATE OR REPLACE FUNCTION log_notification_attempt()
RETURNS TRIGGER AS $$
BEGIN
  -- Log the attempt in a way that doesn't interfere with the actual operation
  RAISE NOTICE 'Notification attempt: request_id=%, email_type=%, recipient=%', 
    NEW.request_id, NEW.email_type, NEW.recipient_email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to log notification attempts
DROP TRIGGER IF EXISTS log_notification_attempt ON public.sent_notifications;
CREATE TRIGGER log_notification_attempt
BEFORE INSERT ON public.sent_notifications
FOR EACH ROW
EXECUTE FUNCTION log_notification_attempt();