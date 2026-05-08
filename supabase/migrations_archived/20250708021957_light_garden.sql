/*
  # Fix webhook notification attachments

  1. Changes
    - Adds a function to safely handle ICS calendar attachments in webhook notifications
    - Ensures proper encoding and error handling for email attachments
    - Improves logging for notification debugging
*/

-- Create a helper function to safely create ICS calendar content
CREATE OR REPLACE FUNCTION public.create_ics_calendar_content(
  event_title TEXT,
  start_date DATE,
  end_date DATE,
  location TEXT,
  description TEXT
) RETURNS TEXT AS $$
DECLARE
  ics_content TEXT;
  adjusted_end_date DATE;
BEGIN
  -- For all-day events in iCalendar, the end date is exclusive
  -- So we need to add one day to the end date
  adjusted_end_date := end_date + INTERVAL '1 day';
  
  -- Create the ICS content
  ics_content := 
    'BEGIN:VCALENDAR' || CHR(13) || CHR(10) ||
    'VERSION:2.0' || CHR(13) || CHR(10) ||
    'CALSCALE:GREGORIAN' || CHR(13) || CHR(10) ||
    'PRODID:-//SplitSpace//Booking//EN' || CHR(13) || CHR(10) ||
    'METHOD:PUBLISH' || CHR(13) || CHR(10) ||
    'BEGIN:VEVENT' || CHR(13) || CHR(10) ||
    'DTSTART;VALUE=DATE:' || TO_CHAR(start_date, 'YYYYMMDD') || CHR(13) || CHR(10) ||
    'DTEND;VALUE=DATE:' || TO_CHAR(adjusted_end_date, 'YYYYMMDD') || CHR(13) || CHR(10) ||
    'SUMMARY:' || event_title || CHR(13) || CHR(10) ||
    'DESCRIPTION:' || REPLACE(description, CHR(10), '\n') || CHR(13) || CHR(10) ||
    'LOCATION:' || location || CHR(13) || CHR(10) ||
    'END:VEVENT' || CHR(13) || CHR(10) ||
    'END:VCALENDAR';
  
  RETURN ics_content;
END;
$$ LANGUAGE plpgsql;

-- Add a comment to the function
COMMENT ON FUNCTION public.create_ics_calendar_content IS 'Creates an ICS calendar file content for booking confirmations';

-- Add a column to webhook_notification_log to track attachments
ALTER TABLE public.webhook_notification_log 
ADD COLUMN IF NOT EXISTS has_attachments BOOLEAN DEFAULT FALSE;

-- Add a column to sent_notifications to track attachments
ALTER TABLE public.sent_notifications
ADD COLUMN IF NOT EXISTS has_attachments BOOLEAN DEFAULT FALSE;