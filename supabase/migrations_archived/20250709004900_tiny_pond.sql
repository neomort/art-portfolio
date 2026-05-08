/*
  # Fix location in ICS files

  1. Changes
     - Create a new overloaded function for create_booking_calendar_attachment_v6 that accepts booking_id and fetches all data
     - This will allow the webhook to call the function with just the booking_id

  2. Security
     - Function is marked as SECURITY DEFINER to ensure it can access the necessary data
*/

-- Create an overloaded version of the calendar attachment function that accepts just the booking_id
CREATE OR REPLACE FUNCTION public.create_booking_calendar_attachment_v6(
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
BEGIN
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
      'parameter_count', 1
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
      'location_parts_count', array_length(location_parts, 1)
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
        'result', result,
        'has_result', result IS NOT NULL,
        'function_version', 'v6_auto',
        'redirect_success', result IS NOT NULL
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

-- Add comment to the function
COMMENT ON FUNCTION public.create_booking_calendar_attachment_v6(TEXT) IS 'Fully automated version that accepts just booking_id and fetches all required data (property title, dates, and complete location)';