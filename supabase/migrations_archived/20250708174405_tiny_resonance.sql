/*
  # Fix Calendar Attachments in Email Notifications

  1. New Functions
    - `create_ics_calendar_content_v3` - Improved ICS content generator with proper formatting
    - `create_booking_calendar_attachment_v3` - Enhanced attachment creator with better error handling
  
  2. Changes
    - Fixes issues with ICS file generation and encoding
    - Ensures proper MIME type and content formatting
    - Adds detailed logging for troubleshooting
*/

-- Create an improved ICS content generator with proper formatting
CREATE OR REPLACE FUNCTION public.create_ics_calendar_content_v3(
  event_title TEXT,
  start_date DATE,
  end_date DATE,
  location TEXT DEFAULT '',
  description TEXT DEFAULT '',
  is_all_day BOOLEAN DEFAULT TRUE
)
RETURNS TEXT AS $$
DECLARE
  ics_content TEXT;
  adjusted_end_date DATE;
  safe_title TEXT;
  safe_description TEXT;
  safe_location TEXT;
  uid TEXT;
  now_timestamp TIMESTAMP;
BEGIN
  -- Generate a unique ID for the event
  uid := gen_random_uuid()::TEXT;
  now_timestamp := now() AT TIME ZONE 'UTC';
  
  -- Sanitize inputs to avoid breaking the ICS format
  safe_title := REGEXP_REPLACE(COALESCE(event_title, 'Event'), '[\\;,]', ' ', 'g');
  safe_description := REGEXP_REPLACE(COALESCE(description, ''), '[\\;,]', ' ', 'g');
  safe_location := REGEXP_REPLACE(COALESCE(location, ''), '[\\;,]', ' ', 'g');
  
  -- For all-day events in iCalendar, the end date is exclusive
  IF is_all_day THEN
    adjusted_end_date := end_date + INTERVAL '1 day';
  ELSE
    adjusted_end_date := end_date;
  END IF;
  
  -- Create the ICS content with proper CRLF line endings
  ics_content := 
    'BEGIN:VCALENDAR' || CHR(13) || CHR(10) ||
    'VERSION:2.0' || CHR(13) || CHR(10) ||
    'CALSCALE:GREGORIAN' || CHR(13) || CHR(10) ||
    'PRODID:-//SplitSpace//Booking//EN' || CHR(13) || CHR(10) ||
    'METHOD:PUBLISH' || CHR(13) || CHR(10) ||
    'BEGIN:VEVENT' || CHR(13) || CHR(10) ||
    'UID:' || uid || CHR(13) || CHR(10) ||
    'DTSTAMP:' || TO_CHAR(now_timestamp, 'YYYYMMDD"T"HH24MISS"Z"') || CHR(13) || CHR(10);
    
  -- Add start and end dates based on whether it's an all-day event
  IF is_all_day THEN
    ics_content := ics_content ||
      'DTSTART;VALUE=DATE:' || TO_CHAR(start_date, 'YYYYMMDD') || CHR(13) || CHR(10) ||
      'DTEND;VALUE=DATE:' || TO_CHAR(adjusted_end_date, 'YYYYMMDD') || CHR(13) || CHR(10);
  ELSE
    -- For timed events, use UTC time format
    ics_content := ics_content ||
      'DTSTART:' || TO_CHAR(start_date, 'YYYYMMDD"T"120000"Z"') || CHR(13) || CHR(10) ||
      'DTEND:' || TO_CHAR(adjusted_end_date, 'YYYYMMDD"T"120000"Z"') || CHR(13) || CHR(10);
  END IF;
  
  -- Add summary (title)
  ics_content := ics_content || 'SUMMARY:' || safe_title || CHR(13) || CHR(10);
  
  -- Add description if provided
  IF safe_description != '' THEN
    ics_content := ics_content || 'DESCRIPTION:' || REPLACE(safe_description, CHR(10), '\n') || CHR(13) || CHR(10);
  END IF;
  
  -- Add location if provided
  IF safe_location != '' THEN
    ics_content := ics_content || 'LOCATION:' || safe_location || CHR(13) || CHR(10);
  END IF;
  
  -- Complete the ICS content
  ics_content := ics_content ||
    'END:VEVENT' || CHR(13) || CHR(10) ||
    'END:VCALENDAR';
  
  RETURN ics_content;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public;

-- Create an enhanced attachment creator with better error handling
CREATE OR REPLACE FUNCTION public.create_booking_calendar_attachment_v3(
  booking_id TEXT,
  property_title TEXT,
  start_date DATE,
  end_date DATE,
  location TEXT DEFAULT ''
)
RETURNS JSONB AS $$
DECLARE
  ics_content TEXT;
  encoded_content TEXT;
  attachment_name TEXT;
  event_title TEXT;
  description TEXT;
  log_id UUID;
BEGIN
  -- Log the function call for debugging
  INSERT INTO public.webhook_notification_log (
    notification_type,
    status,
    booking_id,
    response_data
  ) VALUES (
    'create_calendar_attachment',
    'started',
    booking_id,
    jsonb_build_object(
      'property_title', property_title,
      'start_date', start_date,
      'end_date', end_date,
      'location', location
    )
  ) RETURNING id INTO log_id;
  
  -- Generate a unique attachment name with proper extension
  attachment_name := 'booking-' || substring(booking_id, 1, 8) || '.ics';
  
  -- Create a clean event title
  event_title := 'Booking at ' || COALESCE(property_title, 'Property');
  
  -- Create a helpful description
  description := 'Your booking confirmation from SplitSpace. View details at https://splitspace.app/dashboard';
  
  -- Create the ICS content using the improved function
  ics_content := public.create_ics_calendar_content_v3(
    event_title,
    start_date,
    end_date,
    location,
    description,
    TRUE  -- is_all_day
  );
  
  -- Log the generated ICS content for debugging
  UPDATE public.webhook_notification_log
  SET response_data = jsonb_build_object(
    'ics_content_length', LENGTH(ics_content),
    'ics_content_preview', LEFT(ics_content, 100),
    'attachment_name', attachment_name
  )
  WHERE id = log_id;
  
  -- If ICS content generation failed, return NULL
  IF ics_content IS NULL OR ics_content = '' THEN
    UPDATE public.webhook_notification_log
    SET status = 'error', error = 'Failed to generate ICS content'
    WHERE id = log_id;
    
    RETURN NULL;
  END IF;
  
  -- Encode the ICS content to base64
  encoded_content := encode(convert_to(ics_content, 'UTF8'), 'base64');
  
  -- If encoding failed, return NULL
  IF encoded_content IS NULL THEN
    UPDATE public.webhook_notification_log
    SET status = 'error', error = 'Failed to encode ICS content'
    WHERE id = log_id;
    
    RETURN NULL;
  END IF;
  
  -- Log successful encoding
  UPDATE public.webhook_notification_log
  SET status = 'success',
      response_data = jsonb_build_object(
        'encoded_content_length', LENGTH(encoded_content),
        'attachment_name', attachment_name,
        'content_type', 'text/calendar'
      )
  WHERE id = log_id;
  
  -- Create and return the attachment object with proper MIME type
  RETURN jsonb_build_object(
    'content', encoded_content,
    'name', attachment_name,
    'contentType', 'text/calendar'
  );
EXCEPTION WHEN OTHERS THEN
  -- Log any errors
  UPDATE public.webhook_notification_log
  SET status = 'error',
      error = SQLERRM,
      response_data = jsonb_build_object(
        'error_detail', SQLERRM,
        'error_hint', SQLSTATE
      )
  WHERE id = log_id;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

-- Add comments to the functions
COMMENT ON FUNCTION public.create_ics_calendar_content_v3 IS 'Creates ICS calendar content with proper formatting and sanitization';
COMMENT ON FUNCTION public.create_booking_calendar_attachment_v3 IS 'Creates a complete ICS attachment for booking confirmations with enhanced error handling and logging';