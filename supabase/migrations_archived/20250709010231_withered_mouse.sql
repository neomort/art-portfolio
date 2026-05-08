-- Function to get frontend base URL from system_settings
CREATE OR REPLACE FUNCTION public.get_frontend_base_url()
RETURNS TEXT AS $$
DECLARE
  base_url TEXT;
BEGIN
  SELECT value INTO base_url
  FROM public.system_settings
  WHERE key = 'frontend_base_url';

  RETURN COALESCE(base_url, 'https://splitspace.com'); -- Fallback to default
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

-- Modify create_ics_calendar_content_v5 to use the new function
CREATE OR REPLACE FUNCTION public.create_ics_calendar_content_v5(
  event_title TEXT,
  start_date DATE,
  end_date DATE,
  location TEXT DEFAULT '',
  description TEXT DEFAULT '',
  booking_id TEXT DEFAULT NULL,
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
  dashboard_base_url TEXT;
  specific_dashboard_url TEXT;
BEGIN
  -- Get the frontend base URL
  dashboard_base_url := public.get_frontend_base_url();

  -- Generate a unique ID for the event
  uid := gen_random_uuid()::TEXT;
  now_timestamp := now() AT TIME ZONE 'UTC';
  
  -- Create a specific dashboard URL if booking_id is provided
  IF booking_id IS NOT NULL THEN
    specific_dashboard_url := dashboard_base_url || '/dashboard?booking=' || booking_id;
  ELSE
    specific_dashboard_url := dashboard_base_url || '/dashboard';
  END IF;
  
  -- Update description to include specific booking URL if not provided
  IF description IS NULL OR description = '' THEN
    description := 'Your booking confirmation from SplitSpace. View details at ' || specific_dashboard_url;
  END IF;
  
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
      'DTSTART:' || TO_CHAR(start_date, 'YYYYMMDD"T"HH24MISS"Z"') || CHR(13) || CHR(10) ||
      'DTEND:' || TO_CHAR(adjusted_end_date, 'YYYYMMDD"T"HH24MISS"Z"') || CHR(13) || CHR(10);
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

-- Insert/Update frontend_base_url in system_settings
INSERT INTO public.system_settings (key, value, created_at, updated_at)
VALUES ('frontend_base_url', 'https://splitspace.com', now(), now())
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = EXCLUDED.updated_at;

COMMENT ON FUNCTION public.get_frontend_base_url IS 'Retrieves the frontend base URL from system settings, with a fallback.';