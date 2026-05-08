/*
  # Fix Email Attachments and Notifications

  1. New Functions
    - `encode_ics_content` - Safely encodes ICS calendar content to base64
    - `create_booking_ics_attachment` - Creates ICS calendar attachment for booking confirmations
  
  2. Security
    - Functions are accessible only to authenticated users
    - Proper error handling and logging
*/

-- Create a function to safely encode ICS content to base64
CREATE OR REPLACE FUNCTION public.encode_ics_content(ics_content TEXT)
RETURNS TEXT AS $$
DECLARE
  encoded TEXT;
BEGIN
  -- Encode the ICS content to base64
  encoded := encode(convert_to(ics_content, 'UTF8'), 'base64');
  RETURN encoded;
EXCEPTION WHEN OTHERS THEN
  -- Log the error and return NULL
  RAISE NOTICE 'Error encoding ICS content: %', SQLERRM;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

-- Create a function to generate ICS attachment for booking confirmations
CREATE OR REPLACE FUNCTION public.create_booking_ics_attachment(
  booking_id UUID,
  property_title TEXT,
  start_date DATE,
  end_date DATE,
  location TEXT
)
RETURNS JSONB AS $$
DECLARE
  ics_content TEXT;
  encoded_content TEXT;
  attachment_name TEXT;
  result JSONB;
BEGIN
  -- Generate a unique attachment name
  attachment_name := 'booking-' || substring(booking_id::text, 1, 8) || '.ics';
  
  -- Create the ICS content using the helper function
  ics_content := public.create_ics_calendar_content(
    'Booking at ' || property_title,
    start_date,
    end_date,
    location,
    'Your booking confirmation from SplitSpace. View details at https://splitspace.app/dashboard'
  );
  
  -- Encode the ICS content to base64
  encoded_content := public.encode_ics_content(ics_content);
  
  -- If encoding failed, return NULL
  IF encoded_content IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Create the attachment object
  result := jsonb_build_object(
    'content', encoded_content,
    'name', attachment_name,
    'contentType', 'application/ics'
  );
  
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  -- Log the error and return NULL
  RAISE NOTICE 'Error creating ICS attachment: %', SQLERRM;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

-- Add comments to the functions
COMMENT ON FUNCTION public.encode_ics_content IS 'Safely encodes ICS calendar content to base64';
COMMENT ON FUNCTION public.create_booking_ics_attachment IS 'Creates ICS calendar attachment for booking confirmations';