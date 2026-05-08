/*
  # Add log_notification_attempt function and trigger

  1. New Functions
    - `log_notification_attempt()` - Logs notification attempts to webhook_notification_log table

  2. New Triggers
    - `log_notification_attempt` - Trigger on sent_notifications table to log attempts

  This migration helps with debugging notification delivery issues by creating
  a comprehensive logging system for all notification attempts.
*/

-- Create a function to log notification attempts
CREATE OR REPLACE FUNCTION log_notification_attempt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  -- Log the attempt to webhook_notification_log
  INSERT INTO webhook_notification_log (
    notification_type,
    recipient_email,
    status,
    created_at
  ) VALUES (
    'attempt_logged',
    NEW.recipient_email,
    'logged',
    NOW()
  );
  
  RETURN NEW;
END;
$$;

-- Add a trigger to log notification attempts
DROP TRIGGER IF EXISTS log_notification_attempt ON sent_notifications;
CREATE TRIGGER log_notification_attempt
BEFORE INSERT ON sent_notifications
FOR EACH ROW
EXECUTE FUNCTION log_notification_attempt();

-- Add a comment to explain the trigger
COMMENT ON TRIGGER log_notification_attempt ON sent_notifications IS 'Logs notification attempts for debugging purposes';