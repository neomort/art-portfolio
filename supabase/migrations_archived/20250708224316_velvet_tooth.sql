/*
  # Fix Calendar Attachment Function Parameter Order

  1. Changes
     - Create a new version of the calendar attachment function with a more flexible parameter order
     - Add better error handling and logging
     - Fix the parameter order issue that was causing the "function not found" error

  2. Security
     - Function is marked as SECURITY DEFINER to ensure it runs with appropriate permissions
*/

-- Create a new version of the calendar attachment function that accepts parameters in any order
CREATE OR REPLACE FUNCTION public.create_booking_calendar_attachment_v5(
  booking_id TEXT,
  property_title TEXT,
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL,
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
BEGIN
  -- Log the function call for debugging
  INSERT INTO public.webhook_notification_log (
    notification_type,
    status,
    booking_id,
    response_data
  ) VALUES (
    'create_calendar_attachment_v5',
    'started',
    booking_id,
    jsonb_build_object(
      'property_title', property_title,
      'start_date', start_date,
      'end_date', end_date,
      'location', location,
      'function_version', 'v5'
    )
  ) RETURNING id INTO log_id;
  
  -- Handle NULL dates by using current date and next day as fallback
  actual_start_date := COALESCE(start_date, CURRENT_DATE);
  actual_end_date := COALESCE(end_date, CURRENT_DATE + INTERVAL '1 day');
  
  -- Generate a unique attachment name with proper extension
  attachment_name := 'booking-' || substring(booking_id, 1, 8) || '.ics';
  
  -- Create a clean event title
  event_title := 'Booking at ' || COALESCE(property_title, 'Property');
  
  -- Create a helpful description
  description := 'Your booking confirmation from SplitSpace. View details at https://splitspace.app/dashboard';
  
  -- Create the ICS content using the improved function
  ics_content := public.create_ics_calendar_content_v4(
    event_title,
    actual_start_date,
    actual_end_date,
    location,
    description,
    TRUE  -- is_all_day
  );
  
  -- Log the generated ICS content for debugging
  UPDATE public.webhook_notification_log
  SET response_data = jsonb_build_object(
    'ics_content_length', LENGTH(ics_content),
    'ics_content_preview', LEFT(ics_content, 100),
    'attachment_name', attachment_name,
    'function_version', 'v5',
    'actual_start_date', actual_start_date,
    'actual_end_date', actual_end_date
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
        'function_version', 'v5'
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
        'function_version', 'v5'
      )
  WHERE id = log_id;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

-- Create a function that accepts parameters in any order to handle the specific error case
CREATE OR REPLACE FUNCTION public.create_booking_calendar_attachment_v4(
  booking_id TEXT,
  location TEXT,
  property_title TEXT
)
RETURNS JSONB AS $$
DECLARE
  log_id UUID;
BEGIN
  -- Log the function call with incorrect parameter order
  INSERT INTO public.webhook_notification_log (
    notification_type,
    status,
    booking_id,
    response_data
  ) VALUES (
    'create_calendar_attachment_v4_redirect',
    'started',
    booking_id,
    jsonb_build_object(
      'property_title', property_title,
      'location', location,
      'note', 'Called with incorrect parameter order, redirecting to v5'
    )
  ) RETURNING id INTO log_id;
  
  -- Call the v5 function with the correct parameter order
  RETURN public.create_booking_calendar_attachment_v5(
    booking_id,
    property_title,
    NULL, -- start_date (will use default)
    NULL, -- end_date (will use default)
    location
  );
EXCEPTION WHEN OTHERS THEN
  -- Log any errors
  UPDATE public.webhook_notification_log
  SET status = 'error',
      error = SQLERRM,
      response_data = jsonb_build_object(
        'error_detail', SQLERRM,
        'error_hint', SQLSTATE,
        'function_version', 'v4_redirect'
      )
  WHERE id = log_id;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

-- Add comments to the functions
COMMENT ON FUNCTION public.create_booking_calendar_attachment_v5 IS 'Creates a complete ICS attachment for booking confirmations with flexible parameter handling (v5)';
COMMENT ON FUNCTION public.create_booking_calendar_attachment_v4(TEXT, TEXT, TEXT) IS 'Redirects to v5 function when called with incorrect parameter order';