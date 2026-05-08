/*
# Overloaded Calendar Attachment Function

1. New Functions
   - `create_booking_calendar_attachment_v6(booking_id TEXT, location TEXT, property_title TEXT)`: Overloaded function that accepts three parameters and fetches start_date and end_date from the bookings table.

2. Changes
   - Added a new overloaded version of the calendar attachment function that accepts three parameters
   - The new function queries the bookings table to get start_date and end_date
   - Added comprehensive error handling and logging
   - Maintains backward compatibility with existing function calls

3. Purpose
   - Fixes the "PGRST202" error when the function is called with only three parameters
   - Provides more flexibility in how the function can be called
   - Improves error handling and logging for better debugging
*/

-- Create an overloaded version of the calendar attachment function that accepts three parameters
CREATE OR REPLACE FUNCTION public.create_booking_calendar_attachment_v6(
  booking_id TEXT,
  location TEXT,
  property_title TEXT
)
RETURNS JSONB AS $$
DECLARE
  log_id UUID;
  booking_record RECORD;
  start_date DATE;
  end_date DATE;
  result JSONB;
BEGIN
  -- Log the function call for debugging
  INSERT INTO public.webhook_notification_log (
    notification_type,
    status,
    booking_id,
    response_data
  ) VALUES (
    'create_calendar_attachment_v6_overloaded',
    'started',
    booking_id,
    jsonb_build_object(
      'property_title', property_title,
      'location', location,
      'function_version', 'v6_overloaded',
      'parameter_count', 3
    )
  ) RETURNING id INTO log_id;
  
  -- Fetch the booking record to get start_date and end_date
  BEGIN
    SELECT b.start_date, b.end_date 
    INTO booking_record
    FROM public.bookings b
    WHERE b.id::TEXT = booking_id;
    
    -- Check if booking was found
    IF booking_record IS NULL THEN
      RAISE NOTICE 'Booking not found with ID: %', booking_id;
      
      UPDATE public.webhook_notification_log
      SET status = 'error',
          error = 'Booking not found with ID: ' || booking_id,
          response_data = jsonb_build_object(
            'error_type', 'booking_not_found',
            'booking_id', booking_id
          )
      WHERE id = log_id;
      
      RETURN NULL;
    END IF;
    
    -- Extract dates from the booking record
    start_date := booking_record.start_date;
    end_date := booking_record.end_date;
    
    -- Log the dates found
    UPDATE public.webhook_notification_log
    SET response_data = jsonb_build_object(
      'property_title', property_title,
      'location', location,
      'start_date', start_date,
      'end_date', end_date,
      'function_version', 'v6_overloaded',
      'booking_found', TRUE
    )
    WHERE id = log_id;
    
  EXCEPTION WHEN OTHERS THEN
    -- Log database query error
    UPDATE public.webhook_notification_log
    SET status = 'error',
        error = 'Error fetching booking dates: ' || SQLERRM,
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
        'result', result,
        'has_result', result IS NOT NULL,
        'function_version', 'v6_overloaded',
        'redirect_success', result IS NOT NULL
      )
  WHERE id = log_id;
  
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  -- Log any unexpected errors
  UPDATE public.webhook_notification_log
  SET status = 'error',
      error = 'Unexpected error in overloaded function: ' || SQLERRM,
      response_data = jsonb_build_object(
        'error_detail', SQLERRM,
        'error_hint', SQLSTATE,
        'function_version', 'v6_overloaded'
      )
  WHERE id = log_id;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

-- Add comment to the function
COMMENT ON FUNCTION public.create_booking_calendar_attachment_v6(TEXT, TEXT, TEXT) IS 'Overloaded version that accepts three parameters (booking_id, location, property_title) and fetches start_date and end_date from the bookings table';