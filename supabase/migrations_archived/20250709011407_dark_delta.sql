/*
  # Update frontend URL references

  1. Changes
     - Create get_frontend_base_url function to centralize URL management
     - Update system_settings with correct frontend_base_url (splitspace.com)
     - Update all ICS calendar functions to use the correct URL
     - Replace any hardcoded references to splitspace.app with the correct domain

  2. Security
     - All functions maintain SECURITY DEFINER to ensure proper access control
*/

-- First, create the get_frontend_base_url function if it doesn't exist
CREATE OR REPLACE FUNCTION public.get_frontend_base_url()
RETURNS TEXT AS $$
DECLARE
  frontend_url TEXT;
BEGIN
  -- Try to get the frontend URL from system_settings
  SELECT value INTO frontend_url
  FROM public.system_settings
  WHERE key = 'frontend_base_url';
  
  -- Return the found URL or default to https://splitspace.com
  RETURN COALESCE(frontend_url, 'https://splitspace.com');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

-- Ensure the frontend_base_url setting exists
INSERT INTO public.system_settings (key, value)
VALUES ('frontend_base_url', 'https://splitspace.com')
ON CONFLICT (key) DO UPDATE
SET value = 'https://splitspace.com',
    updated_at = NOW();

-- Drop existing functions to avoid parameter name conflicts
DROP FUNCTION IF EXISTS public.create_ics_calendar_content_v5(TEXT, DATE, DATE, TEXT, TEXT, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.create_booking_calendar_attachment_v6(TEXT, TEXT, DATE, DATE, TEXT);
DROP FUNCTION IF EXISTS public.create_booking_calendar_attachment_v6(TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_booking_calendar_attachment_v6(TEXT);

-- Update create_ics_calendar_content_v5 to use the frontend base URL
CREATE FUNCTION public.create_ics_calendar_content_v5(
  event_title TEXT,
  start_date DATE,
  end_date DATE,
  location TEXT DEFAULT '',
  description TEXT DEFAULT '',
  uid TEXT DEFAULT NULL,
  is_all_day BOOLEAN DEFAULT TRUE
)
RETURNS TEXT AS $$
DECLARE
  ics_content TEXT;
  event_uid TEXT;
  formatted_start TEXT;
  formatted_end TEXT;
  frontend_base_url TEXT;
BEGIN
  -- Get the frontend base URL
  frontend_base_url := public.get_frontend_base_url();
  
  -- Generate a UUID if none provided
  event_uid := COALESCE(uid, gen_random_uuid()::TEXT);
  
  -- Format dates for ICS
  IF is_all_day THEN
    -- For all-day events, use simple date format without time
    formatted_start := TO_CHAR(start_date, 'YYYYMMDD');
    -- For all-day events in ICS, the end date should be the day after the actual end
    -- because the end date is exclusive in the ICS spec for all-day events
    formatted_end := TO_CHAR(end_date + INTERVAL '1 day', 'YYYYMMDD');
  ELSE
    -- For timed events, include time component (assuming UTC)
    formatted_start := TO_CHAR(start_date, 'YYYYMMDD') || 'T000000Z';
    formatted_end := TO_CHAR(end_date, 'YYYYMMDD') || 'T235959Z';
  END IF;
  
  -- Build the ICS content with proper line endings and format
  ics_content := 'BEGIN:VCALENDAR' || CHR(13) || CHR(10) ||
                 'VERSION:2.0' || CHR(13) || CHR(10) ||
                 'PRODID:-//SplitSpace//Booking Calendar//EN' || CHR(13) || CHR(10) ||
                 'CALSCALE:GREGORIAN' || CHR(13) || CHR(10) ||
                 'METHOD:PUBLISH' || CHR(13) || CHR(10) ||
                 'BEGIN:VEVENT' || CHR(13) || CHR(10) ||
                 'UID:' || event_uid || CHR(13) || CHR(10);
  
  -- Add start and end dates with appropriate format based on all-day flag
  IF is_all_day THEN
    ics_content := ics_content ||
                   'DTSTART;VALUE=DATE:' || formatted_start || CHR(13) || CHR(10) ||
                   'DTEND;VALUE=DATE:' || formatted_end || CHR(13) || CHR(10);
  ELSE
    ics_content := ics_content ||
                   'DTSTART:' || formatted_start || CHR(13) || CHR(10) ||
                   'DTEND:' || formatted_end || CHR(13) || CHR(10);
  END IF;
  
  -- Add summary (title)
  ics_content := ics_content ||
                 'SUMMARY:' || COALESCE(event_title, 'Booking') || CHR(13) || CHR(10);
  
  -- Add location if provided
  IF location IS NOT NULL AND location != '' THEN
    ics_content := ics_content ||
                   'LOCATION:' || location || CHR(13) || CHR(10);
  END IF;
  
  -- Add description if provided, with the correct domain
  IF description IS NOT NULL AND description != '' THEN
    -- Replace any instances of splitspace.app with the correct domain
    description := REPLACE(description, 'https://splitspace.app', frontend_base_url);
    
    ics_content := ics_content ||
                   'DESCRIPTION:' || description || CHR(13) || CHR(10);
  END IF;
  
  -- Add creation timestamp
  ics_content := ics_content ||
                 'DTSTAMP:' || TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYYMMDD"T"HH24MISS"Z"') || CHR(13) || CHR(10);
  
  -- Complete the event and calendar
  ics_content := ics_content ||
                 'END:VEVENT' || CHR(13) || CHR(10) ||
                 'END:VCALENDAR';
  
  RETURN ics_content;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

-- Create the first function with proper parameter types
CREATE FUNCTION public.create_booking_calendar_attachment_v6(
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
  actual_start_date DATE;
  actual_end_date DATE;
  frontend_base_url TEXT;
BEGIN
  -- Get the frontend base URL
  frontend_base_url := public.get_frontend_base_url();

  -- Log the function call for debugging
  INSERT INTO public.webhook_notification_log (
    notification_type,
    status,
    booking_id,
    response_data
  ) VALUES (
    'create_calendar_attachment_v6',
    'started',
    booking_id,
    jsonb_build_object(
      'property_title', property_title,
      'start_date', start_date,
      'end_date', end_date,
      'location', location,
      'function_version', 'v6',
      'frontend_base_url', frontend_base_url
    )
  ) RETURNING id INTO log_id;
  
  -- Handle NULL dates by using current date and next day as fallback
  actual_start_date := COALESCE(start_date, CURRENT_DATE);
  actual_end_date := COALESCE(end_date, CURRENT_DATE + INTERVAL '1 day');
  
  -- Generate a unique attachment name with proper extension
  attachment_name := 'booking-' || substring(booking_id, 1, 8) || '.ics';
  
  -- Create a clean event title
  event_title := 'Booking at ' || COALESCE(property_title, 'Property');
  
  -- Create a specific description with booking ID and correct domain
  description := 'Your booking confirmation from SplitSpace. View details at ' || frontend_base_url || '/dashboard?booking=' || booking_id;
  
  -- Create the ICS content using the improved function
  ics_content := public.create_ics_calendar_content_v5(
    event_title,
    actual_start_date,
    actual_end_date,
    location,
    description,
    booking_id,
    TRUE  -- is_all_day
  );
  
  -- Log the generated ICS content for debugging
  UPDATE public.webhook_notification_log
  SET response_data = jsonb_build_object(
    'ics_content_length', LENGTH(ics_content),
    'ics_content_preview', LEFT(ics_content, 100),
    'attachment_name', attachment_name,
    'function_version', 'v6',
    'actual_start_date', actual_start_date,
    'actual_end_date', actual_end_date,
    'frontend_base_url', frontend_base_url
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
        'content_type', 'text/calendar',
        'function_version', 'v6',
        'frontend_base_url', frontend_base_url
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
        'error_hint', SQLSTATE,
        'function_version', 'v6'
      )
  WHERE id = log_id;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

-- Create the second function
CREATE FUNCTION public.create_booking_calendar_attachment_v6(
  booking_id TEXT
)
RETURNS JSONB AS $$
DECLARE
  log_id UUID;
  booking_record RECORD;
  property_record RECORD;
  property_title TEXT;
  location TEXT;
  start_date DATE;
  end_date DATE;
  result JSONB;
  location_parts TEXT[];
  frontend_base_url TEXT;
BEGIN
  -- Get the frontend base URL
  frontend_base_url := public.get_frontend_base_url();

  -- Log the function call for debugging
  INSERT INTO public.webhook_notification_log (
    notification_type,
    status,
    booking_id,
    response_data
  ) VALUES (
    'create_calendar_attachment_v6_auto',
    'started',
    booking_id,
    jsonb_build_object(
      'function_version', 'v6_auto',
      'parameter_count', 1,
      'frontend_base_url', frontend_base_url
    )
  ) RETURNING id INTO log_id;
  
  -- Fetch the booking record with property details
  BEGIN
    SELECT 
      b.start_date, 
      b.end_date,
      p.title AS property_title,
      p.address_street,
      p.address_city,
      p.address_state,
      p.address_postal_code,
      p.address_country
    INTO property_record
    FROM public.bookings b
    JOIN public.properties p ON b.property_id = p.id
    WHERE b.id::TEXT = booking_id;
    
    -- Check if booking was found
    IF property_record IS NULL THEN
      RAISE NOTICE 'Booking or property not found with ID: %', booking_id;
      
      UPDATE public.webhook_notification_log
      SET status = 'error',
          error = 'Booking or property not found with ID: ' || booking_id,
          response_data = jsonb_build_object(
            'error_type', 'booking_or_property_not_found',
            'booking_id', booking_id
          )
      WHERE id = log_id;
      
      RETURN NULL;
    END IF;
    
    -- Extract data from the property record
    property_title := property_record.property_title;
    start_date := property_record.start_date;
    end_date := property_record.end_date;
    
    -- Build a complete location string with all address components
    location_parts := ARRAY[]::TEXT[];
    
    -- Add street address if available
    IF property_record.address_street IS NOT NULL AND property_record.address_street != '' THEN
      location_parts := array_append(location_parts, property_record.address_street);
    END IF;
    
    -- Add city if available
    IF property_record.address_city IS NOT NULL AND property_record.address_city != '' THEN
      location_parts := array_append(location_parts, property_record.address_city);
    END IF;
    
    -- Add state if available
    IF property_record.address_state IS NOT NULL AND property_record.address_state != '' THEN
      location_parts := array_append(location_parts, property_record.address_state);
    END IF;
    
    -- Add postal code if available
    IF property_record.address_postal_code IS NOT NULL AND property_record.address_postal_code != '' THEN
      location_parts := array_append(location_parts, property_record.address_postal_code);
    END IF;
    
    -- Add country if available
    IF property_record.address_country IS NOT NULL AND property_record.address_country != '' THEN
      location_parts := array_append(location_parts, property_record.address_country);
    END IF;
    
    -- Join all parts with commas
    location := array_to_string(location_parts, ', ');
    
    -- Log the data found
    UPDATE public.webhook_notification_log
    SET response_data = jsonb_build_object(
      'property_title', property_title,
      'location', location,
      'start_date', start_date,
      'end_date', end_date,
      'function_version', 'v6_auto',
      'booking_found', TRUE,
      'location_parts_count', array_length(location_parts, 1),
      'frontend_base_url', frontend_base_url
    )
    WHERE id = log_id;
    
  EXCEPTION WHEN OTHERS THEN
    -- Log database query error
    UPDATE public.webhook_notification_log
    SET status = 'error',
        error = 'Error fetching booking and property data: ' || SQLERRM,
        response_data = jsonb_build_object(
          'error_detail', SQLERRM,
          'error_hint', SQLSTATE,
          'booking_id', booking_id
        )
    WHERE id = log_id;
    
    RETURN NULL;
  END;
  
  -- Call the original function with all five parameters
  result := public.create_booking_calendar_attachment_v6(
    booking_id,
    property_title,
    start_date,
    end_date,
    location
  );
  
  -- Log the result
  UPDATE public.webhook_notification_log
  SET status = CASE WHEN result IS NULL THEN 'error' ELSE 'success' END,
      error = CASE WHEN result IS NULL THEN 'Failed to create calendar attachment' ELSE NULL END,
      response_data = jsonb_build_object(
        'result', result IS NOT NULL,
        'has_result', result IS NOT NULL,
        'function_version', 'v6_auto',
        'redirect_success', result IS NOT NULL,
        'frontend_base_url', frontend_base_url
      )
  WHERE id = log_id;
  
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  -- Log any unexpected errors
  UPDATE public.webhook_notification_log
  SET status = 'error',
      error = 'Unexpected error in auto function: ' || SQLERRM,
      response_data = jsonb_build_object(
        'error_detail', SQLERRM,
        'error_hint', SQLSTATE,
        'function_version', 'v6_auto'
      )
  WHERE id = log_id;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

-- Update comments to reflect the changes
COMMENT ON FUNCTION public.create_booking_calendar_attachment_v6(TEXT, TEXT, DATE, DATE, TEXT) IS 'Creates a complete ICS attachment for booking confirmations with complete location and specific booking URL using the configured frontend base URL';
COMMENT ON FUNCTION public.create_booking_calendar_attachment_v6(TEXT) IS 'Fully automated version that accepts just booking_id and fetches all required data using the configured frontend base URL';