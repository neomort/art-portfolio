/*
  # Fix duplicate constraint issue

  1. Changes
    - Add conditional check before creating unique constraint
    - Add comments to table and columns for better documentation
*/

-- Check if constraint exists before creating it
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