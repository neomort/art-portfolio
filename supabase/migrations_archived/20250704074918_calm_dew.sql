-- Create a function to log notification attempts with more detailed information
CREATE OR REPLACE FUNCTION log_notification_attempt()
RETURNS TRIGGER AS $$
BEGIN
  -- Log the attempt with detailed information
  RAISE NOTICE 'Notification attempt: request_id=%, email_type=%, recipient=%, timestamp=%', 
    NEW.request_id, NEW.email_type, NEW.recipient_email, NOW();
    
  -- Check if this is a duplicate (should be caught by the unique constraint, but log it anyway)
  IF EXISTS (
    SELECT 1 FROM sent_notifications 
    WHERE request_id = NEW.request_id
  ) THEN
    RAISE NOTICE 'DUPLICATE DETECTED: request_id=% already exists in sent_notifications', NEW.request_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS log_notification_attempt ON public.sent_notifications;
CREATE TRIGGER log_notification_attempt
BEFORE INSERT ON public.sent_notifications
FOR EACH ROW
EXECUTE FUNCTION log_notification_attempt();

-- Add more detailed comments for documentation
COMMENT ON TABLE public.sent_notifications IS 'Tracks sent email notifications for idempotency and debugging';
COMMENT ON COLUMN public.sent_notifications.request_id IS 'Unique identifier for the notification request - used for idempotency';
COMMENT ON COLUMN public.sent_notifications.email_type IS 'Type of email template used (e.g., message_received, new_inquiry)';
COMMENT ON COLUMN public.sent_notifications.recipient_email IS 'Email address of the recipient for debugging';