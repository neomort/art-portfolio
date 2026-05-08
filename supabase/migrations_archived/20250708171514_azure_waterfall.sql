/*
  # Fix Calendar Attachments for Email Notifications

  1. New Functions
    - `create_booking_calendar_attachment_v2` - Improved version of the calendar attachment generator
    - `encode_ics_content_safely` - Utility function for safe base64 encoding

  2. Changes
    - Adds better error handling for ICS generation
    - Ensures proper MIME type for calendar attachments
    - Fixes encoding issues with special characters in ICS files
*/

-- Create a more robust function to encode ICS content safely
CREATE OR REPLACE FUNCTION public.encode_ics_content_safely(ics_content TEXT)
RETURNS TEXT AS $$
DECLARE
  encoded TEXT;
BEGIN
  -- Use proper encoding for UTF-8 text
  encoded := encode(convert_to(ics_content, 'UTF8'), 'base64');
  RETURN encoded;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error encoding ICS content: %', SQLERRM;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public;

-- Create an improved version of the calendar attachment generator
CREATE OR REPLACE FUNCTION public.create_booking_calendar_attachment_v2(
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
  adjusted_end_date DATE;
BEGIN
  -- Generate a unique attachment name with proper extension
  attachment_name := 'booking-' || substring(booking_id, 1, 8) || '.ics';
  
  -- Create a clean event title
  event_title := 'Booking at ' || COALESCE(property_title, 'Property');
  
  -- Create a helpful description
  description := 'Your booking confirmation from SplitSpace. View details at https://splitspace.app/dashboard';
  
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
    'SUMMARY:' || event_title || CHR(13) || CHR(10);
    
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
  
  -- Encode the ICS content to base64
  encoded_content := public.encode_ics_content_safely(ics_content);
  
  -- If encoding failed, return NULL
  IF encoded_content IS NULL THEN
    RAISE WARNING 'Failed to encode ICS content for booking %', booking_id;
    RETURN NULL;
  END IF;
  
  -- Create and return the attachment object with proper MIME type
  RETURN jsonb_build_object(
    'content', encoded_content,
    'name', attachment_name,
    'contentType', 'text/calendar'
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error creating ICS attachment: %', SQLERRM;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql
SET search_path = pg_catalog, public
SECURITY DEFINER;

-- Add comments to the functions
COMMENT ON FUNCTION public.encode_ics_content_safely IS 'Safely encodes ICS calendar content to base64 with proper error handling';
COMMENT ON FUNCTION public.create_booking_calendar_attachment_v2 IS 'Creates a complete ICS attachment for booking confirmations with improved error handling';