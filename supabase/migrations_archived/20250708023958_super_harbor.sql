/*
  # Fix Email Notification Attachments

  1. New Functions
    - `safe_encode_base64_text` - Safely encodes text to base64 with error handling
    - `validate_email_attachment_object` - Validates and creates an email attachment object
    - `generate_ics_calendar_content` - Generates ICS calendar content with proper formatting
    - `create_booking_calendar_attachment` - Creates a complete ICS attachment for booking confirmations

  2. Changes
    - Renamed all functions to avoid name conflicts
    - Added proper error handling for encoding failures
    - Improved ICS calendar generation with proper date handling
*/

-- Create a function to safely encode text to base64
CREATE OR REPLACE FUNCTION public.safe_encode_base64_text(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(convert_to(input_text, 'UTF8'), 'base64');
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error encoding to base64: %', SQLERRM;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

-- Create a function to validate email attachments
CREATE OR REPLACE FUNCTION public.validate_email_attachment_object(
  content TEXT,
  name TEXT,
  content_type TEXT DEFAULT 'application/octet-stream'
)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  -- Basic validation
  IF content IS NULL OR name IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Create the attachment object
  result := jsonb_build_object(
    'content', content,
    'name', name,
    'contentType', COALESCE(content_type, 'application/octet-stream')
  );
  
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error validating attachment: %', SQLERRM;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

-- Create a function to generate ICS calendar content with proper line endings
CREATE OR REPLACE FUNCTION public.generate_ics_calendar_content(
  title TEXT,
  start_date DATE,
  end_date DATE,
  location TEXT DEFAULT '',
  description TEXT DEFAULT ''
)
RETURNS TEXT AS $$
DECLARE
  ics_content TEXT;
  adjusted_end_date DATE;
BEGIN
  -- For all-day events in iCalendar, the end date is exclusive
  adjusted_end_date := end_date + INTERVAL '1 day';
  
  -- Create the ICS content with proper CRLF line endings
  ics_content := 
    'BEGIN:VCALENDAR' || CHR(13) || CHR(10) ||
    'VERSION:2.0' || CHR(13) || CHR(10) ||
    'CALSCALE:GREGORIAN' || CHR(13) || CHR(10) ||
    'PRODID:-//SplitSpace//Booking//EN' || CHR(13) || CHR(10) ||
    'METHOD:PUBLISH' || CHR(13) || CHR(10) ||
    'BEGIN:VEVENT' || CHR(13) || CHR(10) ||
    'DTSTART;VALUE=DATE:' || TO_CHAR(start_date, 'YYYYMMDD') || CHR(13) || CHR(10) ||
    'DTEND;VALUE=DATE:' || TO_CHAR(adjusted_end_date, 'YYYYMMDD') || CHR(13) || CHR(10) ||
    'SUMMARY:' || title || CHR(13) || CHR(10);
    
  -- Add description if provided
  IF description IS NOT NULL AND description != '' THEN
    ics_content := ics_content || 
      'DESCRIPTION:' || REPLACE(description, CHR(10), '\n') || CHR(13) || CHR(10);
  END IF;
  
  -- Add location if provided
  IF location IS NOT NULL AND location != '' THEN
    ics_content := ics_content || 
      'LOCATION:' || location || CHR(13) || CHR(10);
  END IF;
  
  -- Complete the ICS content
  ics_content := ics_content ||
    'END:VEVENT' || CHR(13) || CHR(10) ||
    'END:VCALENDAR';
  
  RETURN ics_content;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

-- Create a function to generate a complete ICS attachment for emails
CREATE OR REPLACE FUNCTION public.create_booking_calendar_attachment(
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
BEGIN
  -- Generate a unique attachment name
  attachment_name := 'booking-' || substring(booking_id, 1, 8) || '.ics';
  
  -- Create the ICS content
  ics_content := public.generate_ics_calendar_content(
    'Booking at ' || property_title,
    start_date,
    end_date,
    location,
    'Your booking confirmation from SplitSpace. View details at https://splitspace.app/dashboard'
  );
  
  -- Encode the ICS content to base64
  encoded_content := public.safe_encode_base64_text(ics_content);
  
  -- If encoding failed, return NULL
  IF encoded_content IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Create and return the attachment object
  RETURN public.validate_email_attachment_object(
    encoded_content,
    attachment_name,
    'application/octet-stream'
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error creating ICS attachment: %', SQLERRM;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

-- Add comments to the functions
COMMENT ON FUNCTION public.safe_encode_base64_text IS 'Safely encodes text to base64 with error handling';
COMMENT ON FUNCTION public.validate_email_attachment_object IS 'Validates and creates an email attachment object';
COMMENT ON FUNCTION public.generate_ics_calendar_content IS 'Generates ICS calendar content with proper formatting';
COMMENT ON FUNCTION public.create_booking_calendar_attachment IS 'Creates a complete ICS attachment for booking confirmations';

-- Add has_attachments column to webhook_notification_log if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'webhook_notification_log' AND column_name = 'has_attachments'
  ) THEN
    ALTER TABLE webhook_notification_log ADD COLUMN has_attachments BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Add has_attachments column to sent_notifications if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sent_notifications' AND column_name = 'has_attachments'
  ) THEN
    ALTER TABLE sent_notifications ADD COLUMN has_attachments BOOLEAN DEFAULT FALSE;
  END IF;
END $$;