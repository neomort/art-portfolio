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