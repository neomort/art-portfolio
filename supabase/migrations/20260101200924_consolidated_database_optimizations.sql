


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "btree_gist" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."org_adjustment_type" AS ENUM (
    'user_selected_discount',
    'capacity_surcharge',
    'off_hours_adjustment',
    'off_days_adjustment'
);


ALTER TYPE "public"."org_adjustment_type" OWNER TO "postgres";


CREATE TYPE "public"."per_unit" AS ENUM (
    'per_hour',
    'per_day',
    'per_week',
    'per_month',
    'per_booking'
);


ALTER TYPE "public"."per_unit" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_normalize_slug"("s" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  select regexp_replace(lower(trim(coalesce(s,''))), '[^a-z0-9]+', '-', 'g')
$$;


ALTER FUNCTION "public"."_normalize_slug"("s" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_creator_as_org_owner"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (NEW.id, auth.uid(), 'owner')
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."add_creator_as_org_owner"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_user_to_primary_org"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
BEGIN
  SELECT id, primary_organization_id INTO v_user_id, v_org_id
  FROM public.profiles 
  WHERE id = auth.uid();
  
  IF v_org_id IS NOT NULL THEN
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (v_org_id, v_user_id, 'owner')
    ON CONFLICT (organization_id, user_id) DO NOTHING;
  END IF;
END;
$$;


ALTER FUNCTION "public"."add_user_to_primary_org"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_org_service_credit"("p_booking_id" "uuid", "p_payment_intent_id" "text", "p_org_id" "uuid", "p_amount_cents" integer, "p_reason" "text" DEFAULT 'service_credit_applied'::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  inserted boolean := false;
  affected_rows integer := 0;
BEGIN
  -- Insert ledger entry if not exists
  INSERT INTO public.organization_credit_ledger (organization_id, booking_id, payment_intent_id, amount_cents, reason)
  VALUES (p_org_id, p_booking_id, p_payment_intent_id, p_amount_cents, COALESCE(p_reason, 'service_credit_applied'))
  ON CONFLICT (booking_id, payment_intent_id) DO NOTHING;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  inserted := affected_rows > 0;

  IF inserted THEN
    -- Decrement org credit in dollars, never below zero
    UPDATE public.organizations
    SET service_credit = GREATEST(0, COALESCE(service_credit, 0) - (p_amount_cents / 100.0)),
        updated_at = now()
    WHERE id = p_org_id;
  END IF;

  RETURN inserted;
END;
$$;


ALTER FUNCTION "public"."apply_org_service_credit"("p_booking_id" "uuid", "p_payment_intent_id" "text", "p_org_id" "uuid", "p_amount_cents" integer, "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auth_is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select coalesce(
    (current_setting('request.jwt.claims', true)::jsonb ->> 'is_admin')::boolean,
    false
  );
$$;


ALTER FUNCTION "public"."auth_is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_pending_inquiry_rpc"("p_property_id" "uuid", "p_user_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_headcount" integer, "p_selected_adjustment_ids" "text"[], "p_message" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_id uuid;
begin
  insert into public.inquiries (
    property_id,
    user_id,
    start_date,
    end_date,
    headcount,
    selected_adjustment_ids,
    message,
    status
  ) values (
    p_property_id,
    p_user_id,
    p_start_date,
    p_end_date,
    p_headcount,
    p_selected_adjustment_ids,
    p_message,
    'pending'
  )
  returning id into v_id;

  return v_id;
end;
$$;


ALTER FUNCTION "public"."claim_pending_inquiry_rpc"("p_property_id" "uuid", "p_user_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_headcount" integer, "p_selected_adjustment_ids" "text"[], "p_message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_pending_inquiry_rpc"("p_property_id" "uuid", "p_user_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_headcount" integer, "p_selected_adjustment_ids" "uuid"[], "p_message" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_id uuid;
begin
  insert into public.inquiries (
    property_id,
    user_id,
    start_date,
    end_date,
    headcount,
    selected_adjustment_ids,
    message,
    status
  ) values (
    p_property_id,
    p_user_id,
    p_start_date,
    p_end_date,
    p_headcount,
    p_selected_adjustment_ids,
    p_message,
    'pending'
  )
  returning id into v_id;

  return v_id;
end;
$$;


ALTER FUNCTION "public"."claim_pending_inquiry_rpc"("p_property_id" "uuid", "p_user_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_headcount" integer, "p_selected_adjustment_ids" "uuid"[], "p_message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_pending_inquiry_rpc"("p_property_id" "uuid", "p_user_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone, "p_headcount" integer, "p_selected_adjustment_ids" "text"[], "p_message" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_id uuid;
begin
  insert into public.inquiries (
    property_id,
    user_id,
    start_date,
    end_date,
    start_at,
    end_at,
    headcount,
    selected_adjustment_ids,
    message,
    status
  ) values (
    p_property_id,
    p_user_id,
    p_start_date,
    p_end_date,
    p_start_at,
    p_end_at,
    p_headcount,
    p_selected_adjustment_ids,
    p_message,
    'pending'
  )
  returning id into v_id;

  return v_id;
end;
$$;


ALTER FUNCTION "public"."claim_pending_inquiry_rpc"("p_property_id" "uuid", "p_user_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone, "p_headcount" integer, "p_selected_adjustment_ids" "text"[], "p_message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_pending_inquiry_rpc"("p_property_id" "uuid", "p_user_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone, "p_headcount" integer, "p_selected_adjustment_ids" "uuid"[], "p_message" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_id uuid;
begin
  insert into public.inquiries (
    property_id,
    user_id,
    start_date,
    end_date,
    start_at,
    end_at,
    headcount,
    selected_adjustment_ids,
    message,
    status
  ) values (
    p_property_id,
    p_user_id,
    p_start_date,
    p_end_date,
    p_start_at,
    p_end_at,
    p_headcount,
    p_selected_adjustment_ids,
    p_message,
    'pending'
  )
  returning id into v_id;

  return v_id;
end;
$$;


ALTER FUNCTION "public"."claim_pending_inquiry_rpc"("p_property_id" "uuid", "p_user_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone, "p_headcount" integer, "p_selected_adjustment_ids" "uuid"[], "p_message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_edge_rate_limits"() RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  delete from public.edge_rate_limits
  where created_at < now() - interval '30 days';
$$;


ALTER FUNCTION "public"."cleanup_edge_rate_limits"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."convert_invites_for_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_email text;
  v_profile_id uuid;
BEGIN
  v_profile_id := NEW.id;
  v_email := NEW.email;

  IF v_email IS NULL OR length(trim(v_email)) = 0 THEN
    RETURN NEW;
  END IF;

  -- Upsert members for all invites matching this email
  INSERT INTO public.organization_members (organization_id, user_id, role)
  SELECT imi.organization_id, v_profile_id, imi.role
  FROM public.organization_member_invites imi
  WHERE lower(imi.email) = lower(v_email)
  ON CONFLICT (organization_id, user_id)
  DO UPDATE SET role = EXCLUDED.role;

  -- Mark invites accepted
  UPDATE public.organization_member_invites imi
  SET accepted_at = now()
  WHERE lower(imi.email) = lower(v_email)
    AND accepted_at IS NULL;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."convert_invites_for_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_booking_calendar_attachment"("booking_id" "text", "property_title" "text", "start_date" "date", "end_date" "date", "location" "text" DEFAULT ''::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."create_booking_calendar_attachment"("booking_id" "text", "property_title" "text", "start_date" "date", "end_date" "date", "location" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_booking_calendar_attachment_v2"("booking_id" "text", "property_title" "text", "start_date" "date", "end_date" "date", "location" "text" DEFAULT ''::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."create_booking_calendar_attachment_v2"("booking_id" "text", "property_title" "text", "start_date" "date", "end_date" "date", "location" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_booking_calendar_attachment_v3"("booking_id" "text", "property_title" "text", "start_date" "date", "end_date" "date", "location" "text" DEFAULT ''::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."create_booking_calendar_attachment_v3"("booking_id" "text", "property_title" "text", "start_date" "date", "end_date" "date", "location" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_booking_calendar_attachment_v4"("booking_id" "text", "location" "text", "property_title" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."create_booking_calendar_attachment_v4"("booking_id" "text", "location" "text", "property_title" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_booking_calendar_attachment_v4"("booking_id" "text", "property_title" "text", "start_date" "date", "end_date" "date", "location" "text" DEFAULT ''::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
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
    'create_calendar_attachment_v4',
    'started',
    booking_id,
    jsonb_build_object(
      'property_title', property_title,
      'start_date', start_date,
      'end_date', end_date,
      'location', location,
      'function_version', 'v4'
    )
  ) RETURNING id INTO log_id;
  
  -- Generate a unique attachment name with proper extension
  attachment_name := 'booking-' || substring(booking_id, 1, 8) || '.ics';
  
  -- Create a clean event title
  event_title := 'Booking at ' || COALESCE(property_title, 'Property');
  
  -- Create a helpful description
  description := 'Your booking confirmation from SplitSpace. View details at https://splitspace.app/dashboard';
  
  -- Create the ICS content using the improved function
  ics_content := public.create_ics_calendar_content_v4(
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
    'attachment_name', attachment_name,
    'function_version', 'v4'
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
        'function_version', 'v4'
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
        'function_version', 'v4'
      )
  WHERE id = log_id;
  
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."create_booking_calendar_attachment_v4"("booking_id" "text", "property_title" "text", "start_date" "date", "end_date" "date", "location" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_booking_calendar_attachment_v5"("booking_id" "text", "property_title" "text", "start_date" "date" DEFAULT NULL::"date", "end_date" "date" DEFAULT NULL::"date", "location" "text" DEFAULT ''::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."create_booking_calendar_attachment_v5"("booking_id" "text", "property_title" "text", "start_date" "date", "end_date" "date", "location" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_booking_calendar_attachment_v6"("booking_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."create_booking_calendar_attachment_v6"("booking_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_booking_calendar_attachment_v6"("booking_id" "text", "location" "text", "property_title" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."create_booking_calendar_attachment_v6"("booking_id" "text", "location" "text", "property_title" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_booking_calendar_attachment_v6"("booking_id" "text", "property_title" "text", "start_date" "date", "end_date" "date", "location" "text" DEFAULT ''::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."create_booking_calendar_attachment_v6"("booking_id" "text", "property_title" "text", "start_date" "date", "end_date" "date", "location" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_booking_ics_attachment"("booking_id" "uuid", "property_title" "text", "start_date" "date", "end_date" "date", "location" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."create_booking_ics_attachment"("booking_id" "uuid", "property_title" "text", "start_date" "date", "end_date" "date", "location" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_ics_calendar_content"("event_title" "text", "start_date" "date", "end_date" "date", "location" "text", "description" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."create_ics_calendar_content"("event_title" "text", "start_date" "date", "end_date" "date", "location" "text", "description" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_ics_calendar_content_v3"("event_title" "text", "start_date" "date", "end_date" "date", "location" "text" DEFAULT ''::"text", "description" "text" DEFAULT ''::"text", "is_all_day" boolean DEFAULT true) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."create_ics_calendar_content_v3"("event_title" "text", "start_date" "date", "end_date" "date", "location" "text", "description" "text", "is_all_day" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_ics_calendar_content_v4"("event_title" "text", "start_date" "date", "end_date" "date", "location" "text" DEFAULT ''::"text", "description" "text" DEFAULT ''::"text", "is_all_day" boolean DEFAULT true) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."create_ics_calendar_content_v4"("event_title" "text", "start_date" "date", "end_date" "date", "location" "text", "description" "text", "is_all_day" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_ics_calendar_content_v5"("event_title" "text", "start_date" "date", "end_date" "date", "location" "text" DEFAULT ''::"text", "description" "text" DEFAULT ''::"text", "uid" "text" DEFAULT NULL::"text", "is_all_day" boolean DEFAULT true) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."create_ics_calendar_content_v5"("event_title" "text", "start_date" "date", "end_date" "date", "location" "text", "description" "text", "uid" "text", "is_all_day" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."debug_user_org_membership"() RETURNS TABLE("user_id" "uuid", "primary_org_id" "uuid", "is_member" boolean, "member_role" "text", "org_name" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as user_id,
    p.primary_organization_id as primary_org_id,
    EXISTS(
      SELECT 1 FROM public.organization_members om 
      WHERE om.organization_id = p.primary_organization_id 
      AND om.user_id = p.id
    ) as is_member,
    om.role as member_role,
    o.name as org_name
  FROM public.profiles p
  LEFT JOIN public.organization_members om ON om.organization_id = p.primary_organization_id AND om.user_id = p.id
  LEFT JOIN public.organizations o ON o.id = p.primary_organization_id
  WHERE p.id = auth.uid();
END;
$$;


ALTER FUNCTION "public"."debug_user_org_membership"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dequeue_due_review_reminders"("p_limit" integer DEFAULT 20) RETURNS TABLE("reminder_id" "uuid", "booking_id" "uuid", "reminder_type" "text", "scheduled_for" timestamp with time zone, "property_id" "uuid", "property_title" "text", "start_date" "date", "end_date" "date", "guest_id" "uuid", "guest_email" "text", "guest_name" "text", "review_submitted_at" timestamp with time zone, "review_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if coalesce(p_limit, 0) <= 0 then
    p_limit := 20;
  end if;

  return query
  with due as (
    select id
    from public.review_reminders
    where sent_at is null
      and review_submitted_at is null
      and scheduled_for <= now()
      and (processing_started_at is null or processing_started_at < now() - interval '15 minutes')
    order by scheduled_for
    limit p_limit
    for update skip locked
  ), updated as (
    update public.review_reminders r
    set processing_started_at = now()
    from due
    where r.id = due.id
    returning r.*
  )
  select
    u.id as reminder_id,
    u.booking_id,
    u.reminder_type,
    u.scheduled_for,
    u.property_id,
    p.title as property_title,
    b.start_date,
    b.end_date,
    u.guest_id,
    prof.email as guest_email,
    prof.full_name as guest_name,
    u.review_submitted_at,
    u.review_id
  from updated u
  join public.bookings b on b.id = u.booking_id
  join public.properties p on p.id = u.property_id
  join public.profiles prof on prof.id = u.guest_id;
end;
$$;


ALTER FUNCTION "public"."dequeue_due_review_reminders"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."encode_ics_content"("ics_content" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."encode_ics_content"("ics_content" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."encode_ics_content_safely"("ics_content" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."encode_ics_content_safely"("ics_content" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_non_negative_service_credit"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  if NEW.service_credit is null then
    NEW.service_credit := 0;
  end if;
  if NEW.service_credit < 0 then
    NEW.service_credit := 0;
  end if;
  return NEW;
end;
$$;


ALTER FUNCTION "public"."enforce_non_negative_service_credit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."faq_entries_tsv_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  new.search_tsv :=
    setweight(to_tsvector('simple', coalesce(new.question,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.answer_md,'')), 'B');
  return new;
end
$$;


ALTER FUNCTION "public"."faq_entries_tsv_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fix_missing_org_memberships"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Add missing memberships for organization creators
  INSERT INTO public.organization_members (organization_id, user_id, role)
  SELECT DISTINCT 
    o.id as organization_id,
    p.id as user_id,
    'owner' as role
  FROM public.organizations o
  JOIN public.profiles p ON p.primary_organization_id = o.id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.organization_members om 
    WHERE om.organization_id = o.id AND om.user_id = p.id
  );
END;
$$;


ALTER FUNCTION "public"."fix_missing_org_memberships"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fix_webhook_property_query"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  -- Log that the fix was applied
  INSERT INTO public.webhook_notification_log (
    notification_type,
    status,
    response_data
  ) VALUES (
    'fix_webhook_property_query',
    'success',
    jsonb_build_object(
      'message', 'Fixed the property query in the webhook function',
      'timestamp', now(),
      'note', 'This is a marker function to indicate the SQL fix has been applied'
    )
  );
END;
$$;


ALTER FUNCTION "public"."fix_webhook_property_query"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_ics_calendar_content"("title" "text", "start_date" "date", "end_date" "date", "location" "text" DEFAULT ''::"text", "description" "text" DEFAULT ''::"text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."generate_ics_calendar_content"("title" "text", "start_date" "date", "end_date" "date", "location" "text", "description" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_frontend_base_url"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."get_frontend_base_url"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_timezone_names"() RETURNS TABLE("name" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT name FROM cached_timezone_names ORDER BY name;
$$;


ALTER FUNCTION "public"."get_timezone_names"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_inquiry_for_user"("p_property_id" "uuid", "p_user_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone, "p_headcount" integer, "p_selected_adjustment_ids" "uuid"[], "p_message" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_id uuid;
begin
  -- Insert directly; rely on table defaults for id and timestamps
  insert into public.inquiries (
    property_id,
    user_id,
    start_date,
    end_date,
    start_at,
    end_at,
    headcount,
    selected_adjustment_ids,
    message,
    status
  ) values (
    p_property_id,
    p_user_id,
    p_start_date,
    p_end_date,
    p_start_at,
    p_end_at,
    p_headcount,
    p_selected_adjustment_ids,
    coalesce(p_message, 'Guest inquiry'),
    'pending'
  ) returning id into v_id;

  return v_id;
end;
$$;


ALTER FUNCTION "public"."insert_inquiry_for_user"("p_property_id" "uuid", "p_user_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone, "p_headcount" integer, "p_selected_adjustment_ids" "uuid"[], "p_message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT p.is_admin
  FROM public.profiles p
  WHERE p.id = (SELECT auth.uid())
  LIMIT 1;
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_org_admin"("org_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = org_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner','admin')
  );
$$;


ALTER FUNCTION "public"."is_org_admin"("org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_org_member"("org_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = org_id
      AND om.user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_org_member"("org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_org_member_with_role"("org_id" "uuid", "allowed_roles" "text"[]) RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = org_id
      AND om.user_id = auth.uid()
      AND (om.role = ANY(allowed_roles))
  );
$$;


ALTER FUNCTION "public"."is_org_member_with_role"("org_id" "uuid", "allowed_roles" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_platform_admin"() RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_admin = true
  );
$$;


ALTER FUNCTION "public"."is_platform_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_notification_attempt"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  -- Log the attempt to webhook_notification_log for debugging
  INSERT INTO public.webhook_notification_log (
    notification_type,
    recipient_email,
    status,
    created_at
  ) VALUES (
    NEW.email_type,
    NEW.recipient_email,
    'attempt_logged',
    NOW()
  );
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_notification_attempt"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."organizations_set_defaults"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.slug is null or new.slug = '' then
    new.slug = public.slugify(new.name);
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."organizations_set_defaults"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."promote_invites_for_email"("p_email" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_profile_id uuid;
BEGIN
  IF p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RETURN;
  END IF;

  -- Find a profile with matching email
  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE lower(email) = lower(p_email)
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    -- Nothing to do if no profile yet
    RETURN;
  END IF;

  -- Upsert membership(s)
  INSERT INTO public.organization_members (organization_id, user_id, role)
  SELECT imi.organization_id, v_profile_id, imi.role
  FROM public.organization_member_invites imi
  WHERE lower(imi.email) = lower(p_email)
  ON CONFLICT (organization_id, user_id)
  DO UPDATE SET role = EXCLUDED.role;

  -- Mark invites accepted
  UPDATE public.organization_member_invites
  SET accepted_at = now()
  WHERE lower(email) = lower(p_email)
    AND accepted_at IS NULL;
END;
$$;


ALTER FUNCTION "public"."promote_invites_for_email"("p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_timezone_cache"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY cached_timezone_names;
END;
$$;


ALTER FUNCTION "public"."refresh_timezone_cache"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."review_reminders_handle_review_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update public.review_reminders rr
  set review_submitted_at = null,
      review_id = null,
      updated_at = now()
  where rr.review_id = old.id;

  return old;
end;
$$;


ALTER FUNCTION "public"."review_reminders_handle_review_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."review_reminders_handle_review_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_booking_id uuid;
begin
  v_booking_id := null;

  -- Prefer explicit booking_id from review_eligibility JSON when provided
  begin
    if new.review_eligibility ? 'booking_id' then
      v_booking_id := nullif(new.review_eligibility->>'booking_id', '')::uuid;
    end if;
  exception when others then
    v_booking_id := null;
  end;

  -- Fallback: most recent booking for this property/user
  if v_booking_id is null then
    select b.id
      into v_booking_id
    from public.bookings b
    where b.property_id = new.property_id
      and b.user_id = new.reviewer_id
    order by coalesce(b.end_at, b.end_date::timestamptz, b.created_at) desc
    limit 1;
  end if;

  if v_booking_id is null then
    return new;
  end if;

  update public.review_reminders rr
  set review_submitted_at = new.created_at,
      review_id = new.id,
      updated_at = now()
  where rr.booking_id = v_booking_id
    and rr.guest_id = new.reviewer_id
    and rr.review_submitted_at is null;

  return new;
end;
$$;


ALTER FUNCTION "public"."review_reminders_handle_review_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."safe_encode_base64_text"("input_text" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  RETURN encode(convert_to(input_text, 'UTF8'), 'base64');
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error encoding to base64: %', SQLERRM;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."safe_encode_base64_text"("input_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."schedule_review_reminder_for_booking"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_scheduled_for timestamptz;
begin
  -- Only consider bookings that are marked completed
  if new.status is distinct from 'completed' then
    return new;
  end if;

  -- Require a guest/user and property to target
  if new.user_id is null or new.property_id is null then
    return new;
  end if;

  -- Determine when to send: prefer precise end_at when available, otherwise assume end_date at midnight
  v_scheduled_for := coalesce(new.end_at, new.end_date::timestamptz) + interval '7 days';

  -- Guard against missing timestamps (e.g., null end_date) by defaulting to now + 7 days
  if v_scheduled_for is null then
    v_scheduled_for := now() + interval '7 days';
  end if;

  insert into public.review_reminders (booking_id, property_id, guest_id, scheduled_for)
  values (new.id, new.property_id, new.user_id, v_scheduled_for)
  on conflict (booking_id, reminder_type) do update
    set property_id = excluded.property_id,
        guest_id = excluded.guest_id,
        scheduled_for = excluded.scheduled_for,
        processing_started_at = null,
        error_message = null,
        updated_at = now()
    where review_reminders.sent_at is null;

  return new;
end;
$$;


ALTER FUNCTION "public"."schedule_review_reminder_for_booking"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_payment_confirmation_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_customer_email TEXT;
  v_customer_name TEXT;
  v_property_title TEXT;
  v_venue_owner_email TEXT;
  v_venue_owner_name TEXT;
  v_request_id TEXT;
  v_proposal_id UUID;
  v_inquiry_id UUID;
BEGIN
  -- Only proceed if payment_status changed to 'paid'
  IF NEW.payment_status = 'paid' AND OLD.payment_status != 'paid' THEN
    -- Get the proposal_id and related inquiry_id
    v_proposal_id := NEW.proposal_id;
    
    IF v_proposal_id IS NOT NULL THEN
      -- Get the inquiry_id from the proposal
      SELECT inquiry_id INTO v_inquiry_id
      FROM public.proposals
      WHERE id = v_proposal_id;
      
      IF v_inquiry_id IS NOT NULL THEN
        -- Get customer information
        SELECT 
          p.email, 
          p.full_name
        INTO v_customer_email, v_customer_name
        FROM public.profiles p
        JOIN public.inquiries i ON i.user_id = p.id
        WHERE i.id = v_inquiry_id;
        
        -- Get property title and venue owner information (prefer org name)
        SELECT 
          prop.title,
          owner.email,
          COALESCE(org.name, owner.full_name) AS venue_owner_name
        INTO 
          v_property_title,
          v_venue_owner_email,
          v_venue_owner_name
        FROM public.properties prop
        JOIN public.profiles owner ON prop.venue_id = owner.id
        LEFT JOIN public.organizations org ON org.id = owner.primary_organization_id
        JOIN public.inquiries i ON i.property_id = prop.id
        WHERE i.id = v_inquiry_id;
        
        -- Generate unique request IDs for idempotency
        v_request_id := 'payment_confirmation_' || NEW.id;
        
        -- Log the notification attempt for customer
        INSERT INTO public.sent_notifications (
          request_id,
          email_type,
          recipient_email
        ) VALUES (
          v_request_id || '_customer',
          'booking_confirmed',
          v_customer_email
        );
        
        -- Log the notification attempt for venue owner
        INSERT INTO public.sent_notifications (
          request_id,
          email_type,
          recipient_email
        ) VALUES (
          v_request_id || '_owner',
          'payment_received',
          v_venue_owner_email
        );
        
        -- Also log to webhook_notification_log for debugging
        INSERT INTO public.webhook_notification_log (
          payment_intent_id,
          booking_id,
          notification_type,
          recipient_email,
          recipient_name,
          status,
          response_data
        ) VALUES (
          NEW.stripe_payment_intent_id,
          NEW.id::text,
          'payment_confirmation_trigger',
          v_customer_email || ', ' || v_venue_owner_email,
          v_customer_name || ', ' || v_venue_owner_name,
          'trigger_fired',
          jsonb_build_object(
            'property_title', v_property_title,
            'booking_id', NEW.id,
            'amount', NEW.price_total,
            'currency', NEW.currency,
            'request_id', v_request_id
          )
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."send_payment_confirmation_notification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_payment_request_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_inquiry_data RECORD;
  v_customer_email TEXT;
  v_customer_name TEXT;
  v_property_title TEXT;
  v_venue_owner_name TEXT;
  v_request_id TEXT;
BEGIN
  -- Get the inquiry data with related information
  SELECT 
    i.id AS inquiry_id,
    i.user_id,
    p.title AS property_title,
    p.venue_id
  INTO v_inquiry_data
  FROM public.inquiries i
  JOIN public.properties p ON i.property_id = p.id
  WHERE i.id = NEW.inquiry_id;
  
  -- Get customer information
  SELECT 
    email, 
    full_name
  INTO v_customer_email, v_customer_name
  FROM public.profiles
  WHERE id = v_inquiry_data.user_id;
  
  -- Get venue owner name: prefer organization name, fallback to profile full_name
  SELECT 
    COALESCE(o.name, p.full_name)
  INTO v_venue_owner_name
  FROM public.profiles p
  LEFT JOIN public.organizations o ON o.id = p.primary_organization_id
  WHERE p.id = v_inquiry_data.venue_id;
  
  -- Set property title
  v_property_title := v_inquiry_data.property_title;
  
  -- Generate a unique request ID for idempotency
  v_request_id := 'payment_request_' || NEW.id;
  
  -- Log the notification attempt
  INSERT INTO public.sent_notifications (
    request_id,
    email_type,
    recipient_email
  ) VALUES (
    v_request_id,
    'inquiry_response',
    v_customer_email
  );
  
  -- Also log to webhook_notification_log for debugging
  INSERT INTO public.webhook_notification_log (
    notification_type,
    recipient_email,
    recipient_name,
    status,
    booking_id,
    response_data
  ) VALUES (
    'payment_request',
    v_customer_email,
    v_customer_name,
    'trigger_fired',
    NEW.id::text,
    jsonb_build_object(
      'property_title', v_property_title,
      'venue_owner', v_venue_owner_name,
      'request_id', v_request_id,
      'amount', NEW.price_total,
      'currency', NEW.currency
    )
  );
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."send_payment_request_notification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."slugify"("txt" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $_$
  select regexp_replace(lower(trim(regexp_replace($1, '\\s+', ' ', 'g'))), '[^a-z0-9]+', '-', 'g')
$_$;


ALTER FUNCTION "public"."slugify"("txt" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_organization_members_set_primary"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  update public.profiles p
  set primary_organization_id = NEW.organization_id
  where p.id = NEW.user_id
    and p.primary_organization_id is null;
  return NEW;
end $$;


ALTER FUNCTION "public"."trg_organization_members_set_primary"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_profiles_ensure_org_membership"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_org_id uuid;
  v_member_exists boolean;
BEGIN
  -- Only proceed if company_name changed and primary_organization_id is null
  IF (TG_OP = 'UPDATE' AND OLD.company_name IS DISTINCT FROM NEW.company_name AND NEW.primary_organization_id IS NULL) 
     OR (TG_OP = 'INSERT' AND NEW.company_name IS NOT NULL AND NEW.primary_organization_id IS NULL) THEN
    
    -- Find or create organization
    select id into v_org_id from public.organizations where lower(name) = lower(NEW.company_name) limit 1;
    if v_org_id is null then
      insert into public.organizations(name, created_at, updated_at)
      values (NEW.company_name, now(), now())
      returning id into v_org_id;
    end if;
    
    -- Ensure membership exists with 'owner' role
    select exists(
      select 1 from public.organization_members om where om.organization_id = v_org_id and om.user_id = NEW.id
    ) into v_member_exists;
    if not v_member_exists then
      insert into public.organization_members(organization_id, user_id, role)
      values (v_org_id, NEW.id, 'owner');
    end if;
    
    -- Set primary_organization_id on NEW row
    NEW.primary_organization_id := v_org_id;
  END IF;
  RETURN NEW;
END $$;


ALTER FUNCTION "public"."trg_profiles_ensure_org_membership"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_set_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_set_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."uid"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT auth.uid();
$$;


ALTER FUNCTION "public"."uid"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_inquiry_status_on_payment"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  -- Only proceed if payment_status changed to 'paid'
  IF NEW.payment_status = 'paid' AND OLD.payment_status != 'paid' THEN
    -- Find the proposal associated with this booking
    IF NEW.proposal_id IS NOT NULL THEN
      -- Find the inquiry_id using explicit table aliases
      UPDATE public.inquiries i
      SET 
        status = 'payment_completed',
        updated_at = NOW()
      FROM public.proposals p
      WHERE 
        p.id = NEW.proposal_id AND
        i.id = p.inquiry_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_inquiry_status_on_payment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_property_reviews_stats"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE public.properties 
    SET 
      reviews_count = (
        SELECT COUNT(*) FROM public.reviews r 
        WHERE r.property_id = NEW.property_id AND r.status = 'approved'
      ),
      reviews_average_rating = (
        SELECT COALESCE(AVG(rating), 0) FROM public.reviews r 
        WHERE r.property_id = NEW.property_id AND r.status = 'approved'
      )
    WHERE id = NEW.property_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.properties 
    SET 
      reviews_count = (
        SELECT COUNT(*) FROM public.reviews r 
        WHERE r.property_id = OLD.property_id AND r.status = 'approved'
      ),
      reviews_average_rating = (
        SELECT COALESCE(AVG(rating), 0) FROM public.reviews r 
        WHERE r.property_id = OLD.property_id AND r.status = 'approved'
      )
    WHERE id = OLD.property_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_property_reviews_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_property_search_stats"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Update property search relevance scores based on various factors
  UPDATE public.properties 
  SET 
    reviews_count = (
      SELECT COUNT(*) FROM public.reviews r 
      WHERE r.property_id = properties.id AND r.status = 'approved'
    ),
    reviews_average_rating = (
      SELECT COALESCE(AVG(rating), 0) FROM public.reviews r 
      WHERE r.property_id = properties.id AND r.status = 'approved'
    );
END;
$$;


ALTER FUNCTION "public"."update_property_search_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_email_attachment_object"("content" "text", "name" "text", "content_type" "text" DEFAULT 'application/octet-stream'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."validate_email_attachment_object"("content" "text", "name" "text", "content_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_review_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  -- Only allow status changes by property owners
  IF OLD.status != NEW.status AND NOT EXISTS (
    SELECT 1 FROM properties
    WHERE id = NEW.property_id
    AND venue_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only property owners can change review status';
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_review_status"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."analysis_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lease_id" "uuid" NOT NULL,
    "permissibility_status" "text",
    "summary_text" "text",
    "restrictions_summary" "text",
    "responsibilities_summary" "text",
    "monthly_lease_payment" numeric,
    "total_leased_area" numeric,
    "lease_area_unit" "text" DEFAULT 'sq_ft'::"text",
    "raw_ai_response" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "term_length_months" integer,
    "renewal_options" "text",
    "exclusivity_rights" "text",
    "cam_charges" "text",
    "termination_rights" "text",
    "base_rent_psf" numeric,
    CONSTRAINT "analysis_results_permissibility_status_check" CHECK (("permissibility_status" = ANY (ARRAY['permitted_unrestricted'::"text", 'permitted_with_notification'::"text", 'permitted_with_consent'::"text", 'prohibited_with_exceptions'::"text", 'prohibited_absolute'::"text", 'unclear'::"text", 'permitted'::"text", 'prohibited'::"text", 'requires_permission'::"text", 'ambiguous'::"text"])))
);


ALTER TABLE "public"."analysis_results" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "proposal_id" "uuid",
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "price_total" numeric NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "status" "text" DEFAULT 'confirmed'::"text" NOT NULL,
    "payment_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "stripe_payment_intent_id" "text",
    "stripe_client_secret" "text",
    "end_at" timestamp with time zone,
    "kind" "text" DEFAULT 'daily'::"text",
    "service_credit_applied_at" timestamp with time zone,
    "service_credit_applied_cents" integer DEFAULT 0 NOT NULL,
    "service_credit_applied_pi_id" "text",
    "start_at" timestamp with time zone,
    CONSTRAINT "bookings_kind_check" CHECK (("kind" = ANY (ARRAY['daily'::"text", 'hourly'::"text", 'blocked'::"text"]))),
    CONSTRAINT "bookings_service_credit_applied_cents_nonneg" CHECK (("service_credit_applied_cents" >= 0))
);


ALTER TABLE "public"."bookings" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "public"."cached_timezone_names" AS
 SELECT "name"
   FROM "pg_timezone_names"
  WHERE (("name" !~~ 'posix%'::"text") AND ("name" !~~ 'Etc/GMT%'::"text") AND ("name" !~~ 'SystemV/%'::"text"))
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."cached_timezone_names" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."edge_rate_limits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "ip" "text",
    "function" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."edge_rate_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."faq_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."faq_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."faq_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_id" "uuid",
    "question" "text" NOT NULL,
    "answer_md" "text" NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "published" boolean DEFAULT true NOT NULL,
    "search_tsv" "tsvector",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."faq_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."favorites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."favorites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."import_datamining" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "address_street" "text" NOT NULL,
    "address_city" "text" NOT NULL,
    "address_state" "text" NOT NULL,
    "address_postal_code" "text" NOT NULL,
    "address_country" "text" NOT NULL,
    "latitude" double precision NOT NULL,
    "longitude" double precision NOT NULL,
    "photos" "text"[] NOT NULL,
    "price_per_day" numeric,
    "organization_id" "uuid",
    "listing_urls" "text"[],
    "property_url" "text",
    "address" "text",
    "owner_name" "text",
    "owner_phone" "text",
    "owner_email" "text",
    "broker_name" "text",
    "broker_phone" "text",
    "broker_email" "text",
    "broker_url" "text",
    "processing_status" "text" DEFAULT 'pending'::"text",
    "processed_at" timestamp with time zone,
    "processing_errors" "text"[],
    "emailed_ts" timestamp with time zone,
    CONSTRAINT "import_datamining_processing_status_check" CHECK (("processing_status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."import_datamining" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inquiries" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "message" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "end_at" timestamp with time zone,
    "headcount" integer,
    "initiator_closed" boolean DEFAULT false NOT NULL,
    "initiator_deleted" boolean DEFAULT false NOT NULL,
    "initiator_last_read_message_id" "uuid",
    "responder_closed" boolean DEFAULT false NOT NULL,
    "responder_deleted" boolean DEFAULT false NOT NULL,
    "responder_last_read_message_id" "uuid",
    "selected_adjustment_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "start_at" timestamp with time zone
);


ALTER TABLE "public"."inquiries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lease_clauses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lease_id" "uuid" NOT NULL,
    "clause_type" "text" NOT NULL,
    "summary" "text" NOT NULL,
    "risk_flag" "text" DEFAULT 'low'::"text" NOT NULL,
    "original_text" "text" NOT NULL,
    "page_number" integer,
    "confidence_score" numeric DEFAULT 0.0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."lease_clauses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_path" "text" NOT NULL,
    "file_size" bigint NOT NULL,
    "upload_status" "text" DEFAULT 'uploaded'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "leases_upload_status_check" CHECK (("upload_status" = ANY (ARRAY['uploaded'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."leases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "inquiry_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_adjustments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "type" "public"."org_adjustment_type" NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."organization_adjustments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_credit_ledger" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "payment_intent_id" "text" NOT NULL,
    "amount_cents" integer NOT NULL,
    "reason" "text" DEFAULT 'service_credit_applied'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "organization_credit_ledger_amount_cents_check" CHECK (("amount_cents" >= 0))
);


ALTER TABLE "public"."organization_credit_ledger" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_inquiry_forms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "survey_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid"
);


ALTER TABLE "public"."organization_inquiry_forms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_member_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" NOT NULL,
    "invited_by" "uuid",
    "accepted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "organization_member_invites_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'member'::"text"])))
);


ALTER TABLE "public"."organization_member_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_members" (
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."organization_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text",
    "brevo_company_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "about_brand" "text",
    "business_type" "text",
    "charges_enabled" boolean DEFAULT false,
    "default_timezone" "text",
    "payouts_enabled" boolean DEFAULT false,
    "service_credit" numeric DEFAULT 0 NOT NULL,
    "stripe_account_id" "text"
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "type" "text" DEFAULT 'Information'::"text" NOT NULL,
    "page_type" "text" DEFAULT 'Information'::"text" NOT NULL,
    CONSTRAINT "pages_type_check" CHECK (("type" = ANY (ARRAY['Support'::"text", 'Legal'::"text", 'News'::"text", 'Information'::"text", 'Documentation'::"text", 'Landing Page'::"text", 'Features'::"text"]))),
    CONSTRAINT "valid_page_types" CHECK (("page_type" = ANY (ARRAY['Support'::"text", 'Legal'::"text", 'News'::"text", 'Information'::"text", 'Landing Page'::"text", 'Features'::"text"])))
);


ALTER TABLE "public"."pages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "phone" "text",
    "avatar_url" "text",
    "email" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_admin" boolean DEFAULT false,
    "brevo_opt_in" boolean DEFAULT false,
    "brevo_opt_in_ts" timestamp with time zone,
    "primary_organization_id" "uuid",
    "survey_answers" "jsonb" DEFAULT '[]'::"jsonb",
    "password_set" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."properties" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "address_street" "text" NOT NULL,
    "address_city" "text" NOT NULL,
    "address_state" "text" NOT NULL,
    "address_postal_code" "text" NOT NULL,
    "address_country" "text" NOT NULL,
    "latitude" double precision NOT NULL,
    "longitude" double precision NOT NULL,
    "images" "text"[] NOT NULL,
    "price_per_day" numeric,
    "inquire_for_pricing" boolean DEFAULT false NOT NULL,
    "square_feet" integer NOT NULL,
    "amenities" "text"[] NOT NULL,
    "property_type" "text" NOT NULL,
    "venue_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "organization_id" "uuid",
    "applied_adjustment_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "capacity" integer,
    "currency" "text",
    "downloadable_files" "jsonb",
    "fast_responder" boolean,
    "featured" boolean DEFAULT false,
    "fee_description" "text",
    "fee_type" "text" DEFAULT 'percentage'::"text",
    "fee_value" numeric DEFAULT 0,
    "floor_plan" "text",
    "iana_timezone" "text",
    "location_type" "text"[],
    "metro_area" "text",
    "monthly_percent" integer,
    "monthly_rate" numeric(10,2),
    "monthly_rate_type" "text",
    "monthly_rate_value" numeric,
    "neighborhood" "text",
    "price_per_hour" numeric,
    "published" boolean DEFAULT false,
    "space_attributes" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "tax_rate" numeric DEFAULT 0,
    "virtual_tour_url" "text",
    "weekly_percent" integer,
    "weekly_rate" numeric(10,2),
    "weekly_rate_type" "text",
    "weekly_rate_value" numeric,
    "yearly_percent" integer,
    "yearly_rate" numeric(10,2),
    "yearly_rate_type" "text",
    "yearly_rate_value" numeric,
    "reviews_count" integer DEFAULT 0,
    "reviews_average_rating" numeric(3,2) DEFAULT 0,
    CONSTRAINT "properties_fee_type_check" CHECK (("fee_type" = ANY (ARRAY['percentage'::"text", 'fixed'::"text"]))),
    CONSTRAINT "properties_monthly_rate_type_check" CHECK ((("monthly_rate_type" IS NULL) OR ("monthly_rate_type" = ANY (ARRAY['fixed'::"text", 'percentage'::"text"])))),
    CONSTRAINT "properties_weekly_rate_type_check" CHECK ((("weekly_rate_type" IS NULL) OR ("weekly_rate_type" = ANY (ARRAY['fixed'::"text", 'percentage'::"text"])))),
    CONSTRAINT "properties_yearly_rate_type_check" CHECK ((("yearly_rate_type" IS NULL) OR ("yearly_rate_type" = ANY (ARRAY['fixed'::"text", 'percentage'::"text"]))))
);


ALTER TABLE "public"."properties" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."property_availability" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."property_availability" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."property_schedule" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "available_from" "date",
    "available_until" "date",
    "daily_schedule" "jsonb" DEFAULT '{"friday": {"end": "5:00pm", "start": "9:00am", "enabled": true}, "monday": {"end": "5:00pm", "start": "9:00am", "enabled": true}, "sunday": {"end": "5:00pm", "start": "9:00am", "enabled": false}, "tuesday": {"end": "5:00pm", "start": "9:00am", "enabled": true}, "saturday": {"end": "5:00pm", "start": "9:00am", "enabled": false}, "thursday": {"end": "5:00pm", "start": "9:00am", "enabled": true}, "wednesday": {"end": "5:00pm", "start": "9:00am", "enabled": true}}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "limit_availability" boolean DEFAULT true,
    "ical_url" "text"
);


ALTER TABLE "public"."property_schedule" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."proposals" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "inquiry_id" "uuid" NOT NULL,
    "price_total" numeric NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "message" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "request_id" "text"
);


ALTER TABLE "public"."proposals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."review_reminders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    "guest_id" "uuid" NOT NULL,
    "reminder_type" "text" DEFAULT 'review_first'::"text" NOT NULL,
    "scheduled_for" timestamp with time zone NOT NULL,
    "processing_started_at" timestamp with time zone,
    "sent_at" timestamp with time zone,
    "email_request_id" "text",
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "review_submitted_at" timestamp with time zone,
    "review_id" "uuid"
);


ALTER TABLE "public"."review_reminders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."review_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "review_id" "uuid" NOT NULL,
    "responder_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "review_responses_content_check" CHECK (("length"("content") <= 1000))
);


ALTER TABLE "public"."review_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "reviewer_id" "uuid" NOT NULL,
    "rating" integer NOT NULL,
    "content" "text" NOT NULL,
    "verified_booking" boolean DEFAULT false NOT NULL,
    "review_eligibility" "jsonb" DEFAULT '{"booking_id": null, "inquiry_id": null, "payment_status": "none", "completed_booking": false}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reviews_content_check" CHECK ((("length"("content") >= 20) AND ("length"("content") <= 1000))),
    CONSTRAINT "reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5))),
    CONSTRAINT "reviews_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sent_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "text" NOT NULL,
    "email_type" "text" NOT NULL,
    "recipient_email" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "has_attachments" boolean DEFAULT false
);


ALTER TABLE "public"."sent_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "value" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."system_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."webhook_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text",
    "event_id" "text",
    "payment_intent_id" "text",
    "booking_id" "text",
    "status" "text",
    "error" "text",
    "request_body" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."webhook_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."webhook_notification_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payment_intent_id" "text",
    "booking_id" "text",
    "notification_type" "text",
    "recipient_email" "text",
    "recipient_name" "text",
    "status" "text",
    "error" "text",
    "response_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "has_attachments" boolean DEFAULT false
);


ALTER TABLE "public"."webhook_notification_log" OWNER TO "postgres";


ALTER TABLE ONLY "public"."analysis_results"
    ADD CONSTRAINT "analysis_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."edge_rate_limits"
    ADD CONSTRAINT "edge_rate_limits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."faq_categories"
    ADD CONSTRAINT "faq_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."faq_categories"
    ADD CONSTRAINT "faq_categories_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."faq_entries"
    ADD CONSTRAINT "faq_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."import_datamining"
    ADD CONSTRAINT "import_datamining_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inquiries"
    ADD CONSTRAINT "inquiries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lease_clauses"
    ADD CONSTRAINT "lease_clauses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leases"
    ADD CONSTRAINT "leases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_adjustments"
    ADD CONSTRAINT "organization_adjustments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_credit_ledger"
    ADD CONSTRAINT "organization_credit_ledger_booking_id_payment_intent_id_key" UNIQUE ("booking_id", "payment_intent_id");



ALTER TABLE ONLY "public"."organization_credit_ledger"
    ADD CONSTRAINT "organization_credit_ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_inquiry_forms"
    ADD CONSTRAINT "organization_inquiry_forms_organization_id_key" UNIQUE ("organization_id");



ALTER TABLE ONLY "public"."organization_inquiry_forms"
    ADD CONSTRAINT "organization_inquiry_forms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_member_invites"
    ADD CONSTRAINT "organization_member_invites_organization_id_email_key" UNIQUE ("organization_id", "email");



ALTER TABLE ONLY "public"."organization_member_invites"
    ADD CONSTRAINT "organization_member_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_pkey" PRIMARY KEY ("organization_id", "user_id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."pages"
    ADD CONSTRAINT "pages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pages"
    ADD CONSTRAINT "pages_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."property_availability"
    ADD CONSTRAINT "property_availability_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."property_schedule"
    ADD CONSTRAINT "property_schedule_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."property_schedule"
    ADD CONSTRAINT "property_schedule_property_id_key" UNIQUE ("property_id");



ALTER TABLE ONLY "public"."proposals"
    ADD CONSTRAINT "proposals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."review_reminders"
    ADD CONSTRAINT "review_reminders_booking_id_reminder_type_key" UNIQUE ("booking_id", "reminder_type");



ALTER TABLE ONLY "public"."review_reminders"
    ADD CONSTRAINT "review_reminders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."review_responses"
    ADD CONSTRAINT "review_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sent_notifications"
    ADD CONSTRAINT "sent_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sent_notifications"
    ADD CONSTRAINT "sent_notifications_request_id_key" UNIQUE ("request_id");



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "unique_payment_intent" UNIQUE ("stripe_payment_intent_id");



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "unique_user_property_favorite" UNIQUE ("user_id", "property_id");



ALTER TABLE ONLY "public"."webhook_logs"
    ADD CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."webhook_notification_log"
    ADD CONSTRAINT "webhook_notification_log_pkey" PRIMARY KEY ("id");



CREATE INDEX "bookings_property_created_at_idx" ON "public"."bookings" USING "btree" ("property_id", "created_at" DESC);



CREATE INDEX "bookings_user_created_at_idx" ON "public"."bookings" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_bookings_proposal_id" ON "public"."bookings" USING "btree" ("proposal_id");



CREATE UNIQUE INDEX "idx_cached_timezone_names_unique" ON "public"."cached_timezone_names" USING "btree" ("name");



CREATE INDEX "idx_favorites_property_id" ON "public"."favorites" USING "btree" ("property_id");



CREATE INDEX "idx_inquiries_property_id" ON "public"."inquiries" USING "btree" ("property_id");



CREATE INDEX "idx_inquiries_user_id" ON "public"."inquiries" USING "btree" ("user_id");



CREATE INDEX "idx_messages_inquiry_id" ON "public"."messages" USING "btree" ("inquiry_id");



CREATE INDEX "idx_messages_sender_id" ON "public"."messages" USING "btree" ("sender_id");



CREATE INDEX "idx_org_adjustments_org" ON "public"."organization_adjustments" USING "btree" ("organization_id");



CREATE INDEX "idx_org_adjustments_org_sort" ON "public"."organization_adjustments" USING "btree" ("organization_id", "sort_order");



CREATE INDEX "idx_organization_credit_ledger_organization_id" ON "public"."organization_credit_ledger" USING "btree" ("organization_id");



CREATE INDEX "idx_organization_inquiry_forms_updated_by" ON "public"."organization_inquiry_forms" USING "btree" ("updated_by");



CREATE INDEX "idx_organization_member_invites_invited_by" ON "public"."organization_member_invites" USING "btree" ("invited_by");



CREATE INDEX "idx_profiles_primary_organization_id" ON "public"."profiles" USING "btree" ("primary_organization_id");



CREATE INDEX "idx_properties_featured" ON "public"."properties" USING "btree" ("featured") WHERE ("featured" = true);



CREATE INDEX "idx_properties_organization_id" ON "public"."properties" USING "btree" ("organization_id");



CREATE INDEX "idx_properties_reviews_avg_rating" ON "public"."properties" USING "btree" ("reviews_average_rating") WHERE ("reviews_average_rating" > (0)::numeric);



CREATE INDEX "idx_properties_reviews_count" ON "public"."properties" USING "btree" ("reviews_count") WHERE ("reviews_count" > 0);



CREATE INDEX "idx_properties_venue_id" ON "public"."properties" USING "btree" ("venue_id");



CREATE INDEX "idx_property_availability_property_id" ON "public"."property_availability" USING "btree" ("property_id");



CREATE INDEX "idx_property_schedule_ical_url" ON "public"."property_schedule" USING "btree" ("property_id") WHERE ("ical_url" IS NOT NULL);



CREATE INDEX "idx_proposals_inquiry_id" ON "public"."proposals" USING "btree" ("inquiry_id");



CREATE INDEX "idx_review_reminders_property_id" ON "public"."review_reminders" USING "btree" ("property_id");



CREATE INDEX "idx_review_responses_responder_id" ON "public"."review_responses" USING "btree" ("responder_id");



CREATE INDEX "idx_reviews_property_id" ON "public"."reviews" USING "btree" ("property_id");



CREATE INDEX "idx_reviews_reviewer_id" ON "public"."reviews" USING "btree" ("reviewer_id");



CREATE INDEX "idx_sent_notifications_request_id" ON "public"."sent_notifications" USING "btree" ("request_id");



CREATE INDEX "import_datamining_organization_id_idx" ON "public"."import_datamining" USING "btree" ("organization_id");



CREATE INDEX "organization_members_org_idx" ON "public"."organization_members" USING "btree" ("organization_id");



CREATE INDEX "organization_members_user_idx" ON "public"."organization_members" USING "btree" ("user_id");



CREATE UNIQUE INDEX "proposals_request_id_key" ON "public"."proposals" USING "btree" ("request_id") WHERE ("request_id" IS NOT NULL);



CREATE OR REPLACE TRIGGER "bookings_schedule_review_reminder" AFTER INSERT OR UPDATE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."schedule_review_reminder_for_booking"();



CREATE OR REPLACE TRIGGER "faq_entries_tsv_update" BEFORE INSERT OR UPDATE ON "public"."faq_entries" FOR EACH ROW EXECUTE FUNCTION "public"."faq_entries_tsv_trigger"();



CREATE OR REPLACE TRIGGER "log_notification_attempt" BEFORE INSERT ON "public"."sent_notifications" FOR EACH ROW EXECUTE FUNCTION "public"."log_notification_attempt"();



CREATE OR REPLACE TRIGGER "organizations_biu_defaults" BEFORE INSERT OR UPDATE ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."organizations_set_defaults"();



CREATE OR REPLACE TRIGGER "organizations_updated_at" BEFORE UPDATE ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "review_reminders_after_review_delete" AFTER DELETE ON "public"."reviews" FOR EACH ROW EXECUTE FUNCTION "public"."review_reminders_handle_review_delete"();



CREATE OR REPLACE TRIGGER "review_reminders_after_review_insert" AFTER INSERT ON "public"."reviews" FOR EACH ROW EXECUTE FUNCTION "public"."review_reminders_handle_review_insert"();



CREATE OR REPLACE TRIGGER "review_reminders_set_updated_at" BEFORE UPDATE ON "public"."review_reminders" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "send_payment_confirmation_notification" AFTER UPDATE ON "public"."bookings" FOR EACH ROW WHEN ((("new"."payment_status" = 'paid'::"text") AND ("old"."payment_status" <> 'paid'::"text"))) EXECUTE FUNCTION "public"."send_payment_confirmation_notification"();



CREATE OR REPLACE TRIGGER "send_payment_request_notification_trigger" AFTER INSERT ON "public"."proposals" FOR EACH ROW EXECUTE FUNCTION "public"."send_payment_request_notification"();



CREATE OR REPLACE TRIGGER "set_timestamp" BEFORE UPDATE ON "public"."organization_adjustments" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "trg_add_creator_as_org_owner" AFTER INSERT ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."add_creator_as_org_owner"();



CREATE OR REPLACE TRIGGER "trg_convert_invites_on_profile_insert" AFTER INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."convert_invites_for_profile"();



CREATE OR REPLACE TRIGGER "trg_convert_invites_on_profile_update" AFTER UPDATE OF "email" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."convert_invites_for_profile"();



CREATE OR REPLACE TRIGGER "trg_organization_members_set_primary_ai" AFTER INSERT ON "public"."organization_members" FOR EACH ROW EXECUTE FUNCTION "public"."trg_organization_members_set_primary"();



CREATE OR REPLACE TRIGGER "update_analysis_results_updated_at" BEFORE UPDATE ON "public"."analysis_results" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_bookings_updated_at" BEFORE UPDATE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_inquiries_updated_at" BEFORE UPDATE ON "public"."inquiries" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_inquiry_on_payment" AFTER UPDATE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."update_inquiry_status_on_payment"();



CREATE OR REPLACE TRIGGER "update_leases_updated_at" BEFORE UPDATE ON "public"."leases" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_pages_updated_at" BEFORE UPDATE ON "public"."pages" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_properties_updated_at" BEFORE UPDATE ON "public"."properties" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_property_reviews_stats_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."reviews" FOR EACH ROW EXECUTE FUNCTION "public"."update_property_reviews_stats"();



CREATE OR REPLACE TRIGGER "update_property_schedule_updated_at" BEFORE UPDATE ON "public"."property_schedule" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_proposals_updated_at" BEFORE UPDATE ON "public"."proposals" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_review_responses_updated_at" BEFORE UPDATE ON "public"."review_responses" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_reviews_updated_at" BEFORE UPDATE ON "public"."reviews" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_system_settings_updated_at" BEFORE UPDATE ON "public"."system_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "validate_review_status" BEFORE UPDATE ON "public"."reviews" FOR EACH ROW EXECUTE FUNCTION "public"."validate_review_status"();



ALTER TABLE ONLY "public"."analysis_results"
    ADD CONSTRAINT "analysis_results_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."faq_entries"
    ADD CONSTRAINT "faq_entries_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."faq_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inquiries"
    ADD CONSTRAINT "fk_initiator_last_read_message" FOREIGN KEY ("initiator_last_read_message_id") REFERENCES "public"."messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inquiries"
    ADD CONSTRAINT "fk_responder_last_read_message" FOREIGN KEY ("responder_last_read_message_id") REFERENCES "public"."messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."import_datamining"
    ADD CONSTRAINT "import_datamining_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."inquiries"
    ADD CONSTRAINT "inquiries_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inquiries"
    ADD CONSTRAINT "inquiries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."lease_clauses"
    ADD CONSTRAINT "lease_clauses_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leases"
    ADD CONSTRAINT "leases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "public"."inquiries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."organization_adjustments"
    ADD CONSTRAINT "organization_adjustments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_credit_ledger"
    ADD CONSTRAINT "organization_credit_ledger_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_credit_ledger"
    ADD CONSTRAINT "organization_credit_ledger_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_inquiry_forms"
    ADD CONSTRAINT "organization_inquiry_forms_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_inquiry_forms"
    ADD CONSTRAINT "organization_inquiry_forms_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."organization_member_invites"
    ADD CONSTRAINT "organization_member_invites_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_member_invites"
    ADD CONSTRAINT "organization_member_invites_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_primary_organization_id_fkey" FOREIGN KEY ("primary_organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."property_availability"
    ADD CONSTRAINT "property_availability_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."property_schedule"
    ADD CONSTRAINT "property_schedule_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposals"
    ADD CONSTRAINT "proposals_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "public"."inquiries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_reminders"
    ADD CONSTRAINT "review_reminders_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_reminders"
    ADD CONSTRAINT "review_reminders_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_reminders"
    ADD CONSTRAINT "review_reminders_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_reminders"
    ADD CONSTRAINT "review_reminders_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."review_responses"
    ADD CONSTRAINT "review_responses_responder_id_fkey" FOREIGN KEY ("responder_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."review_responses"
    ADD CONSTRAINT "review_responses_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "public"."profiles"("id");



CREATE POLICY "Admins can manage categories" ON "public"."faq_categories" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."is_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."is_admin" = true)))));



CREATE POLICY "Admins can manage entries" ON "public"."faq_entries" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."is_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."is_admin" = true)))));



CREATE POLICY "Admins can manage pages" ON "public"."pages" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."is_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."is_admin" = true)))));



CREATE POLICY "Admins can manage system settings" ON "public"."system_settings" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."is_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."is_admin" = true)))));



CREATE POLICY "Admins can view webhook logs" ON "public"."webhook_logs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."is_admin" = true)))));



CREATE POLICY "Allow authenticated users to create organizations" ON "public"."organizations" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Everyone can read properties" ON "public"."properties" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Inquiry creators and property owners can delete inquiries" ON "public"."inquiries" FOR DELETE TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."properties" "p"
  WHERE (("p"."id" = "inquiries"."property_id") AND ("p"."venue_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "Organization admins can manage adjustments" ON "public"."organization_adjustments" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "organization_adjustments"."organization_id") AND ("om"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("om"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "organization_adjustments"."organization_id") AND ("om"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("om"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "Organization admins can manage organizations" ON "public"."organizations" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "organizations"."id") AND ("om"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("om"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "organizations"."id") AND ("om"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("om"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "Participants and org members can read inquiries" ON "public"."inquiries" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."properties" "p"
  WHERE (("p"."id" = "inquiries"."property_id") AND (("p"."venue_id" = ( SELECT "auth"."uid"() AS "uid")) OR (("p"."organization_id" IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM "public"."organization_members" "om"
          WHERE (("om"."organization_id" = "p"."organization_id") AND ("om"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))))))));



CREATE POLICY "Participants and org members can update inquiries" ON "public"."inquiries" FOR UPDATE TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."properties" "p"
  WHERE (("p"."id" = "inquiries"."property_id") AND (("p"."venue_id" = ( SELECT "auth"."uid"() AS "uid")) OR (("p"."organization_id" IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM "public"."organization_members" "om"
          WHERE (("om"."organization_id" = "p"."organization_id") AND ("om"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))))))))) WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."properties" "p"
  WHERE (("p"."id" = "inquiries"."property_id") AND (("p"."venue_id" = ( SELECT "auth"."uid"() AS "uid")) OR (("p"."organization_id" IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM "public"."organization_members" "om"
          WHERE (("om"."organization_id" = "p"."organization_id") AND ("om"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))))))));



CREATE POLICY "Property owners can create proposals" ON "public"."proposals" FOR INSERT TO "authenticated" WITH CHECK (("inquiry_id" IN ( SELECT "i"."id"
   FROM "public"."inquiries" "i"
  WHERE (EXISTS ( SELECT 1
           FROM "public"."properties" "p"
          WHERE (("p"."id" = "i"."property_id") AND (("p"."venue_id" = ( SELECT "auth"."uid"() AS "uid")) OR (("p"."organization_id" IS NOT NULL) AND (EXISTS ( SELECT 1
                   FROM "public"."organization_members" "om"
                  WHERE (("om"."organization_id" = "p"."organization_id") AND ("om"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))))))))));



CREATE POLICY "Property owners can delete properties" ON "public"."properties" FOR DELETE TO "authenticated" USING (("venue_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Property owners can manage availability" ON "public"."property_availability" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."properties" "p"
  WHERE (("p"."id" = "property_availability"."property_id") AND (("p"."venue_id" = ( SELECT "auth"."uid"() AS "uid")) OR (("p"."organization_id" IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM "public"."organization_members" "om"
          WHERE (("om"."organization_id" = "p"."organization_id") AND ("om"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."properties" "p"
  WHERE (("p"."id" = "property_availability"."property_id") AND (("p"."venue_id" = ( SELECT "auth"."uid"() AS "uid")) OR (("p"."organization_id" IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM "public"."organization_members" "om"
          WHERE (("om"."organization_id" = "p"."organization_id") AND ("om"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))))))));



CREATE POLICY "Property owners can manage schedules" ON "public"."property_schedule" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."properties" "p"
  WHERE (("p"."id" = "property_schedule"."property_id") AND ("p"."venue_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."properties" "p"
  WHERE (("p"."id" = "property_schedule"."property_id") AND ("p"."venue_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Property owners can update properties" ON "public"."properties" FOR UPDATE TO "authenticated" USING (("venue_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("venue_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Property owners can update proposals" ON "public"."proposals" FOR UPDATE TO "authenticated" USING (("inquiry_id" IN ( SELECT "i"."id"
   FROM "public"."inquiries" "i"
  WHERE (EXISTS ( SELECT 1
           FROM "public"."properties" "p"
          WHERE (("p"."id" = "i"."property_id") AND (("p"."venue_id" = ( SELECT "auth"."uid"() AS "uid")) OR (("p"."organization_id" IS NOT NULL) AND (EXISTS ( SELECT 1
                   FROM "public"."organization_members" "om"
                  WHERE (("om"."organization_id" = "p"."organization_id") AND ("om"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))))))))));



CREATE POLICY "Property owners can update responses" ON "public"."review_responses" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."reviews" "r"
  WHERE (("r"."id" = "review_responses"."review_id") AND (EXISTS ( SELECT 1
           FROM "public"."properties" "p"
          WHERE (("p"."id" = "r"."property_id") AND ("p"."venue_id" = ( SELECT "auth"."uid"() AS "uid"))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."reviews" "r"
  WHERE (("r"."id" = "review_responses"."review_id") AND (EXISTS ( SELECT 1
           FROM "public"."properties" "p"
          WHERE (("p"."id" = "r"."property_id") AND ("p"."venue_id" = ( SELECT "auth"."uid"() AS "uid")))))))));



CREATE POLICY "Public can read approved reviews" ON "public"."reviews" FOR SELECT TO "anon" USING (("status" = 'approved'::"text"));



CREATE POLICY "Public can read categories" ON "public"."faq_categories" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Public can read pages" ON "public"."pages" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Public can read published adjustments" ON "public"."organization_adjustments" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Public can read published availability" ON "public"."property_availability" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Public can read published entries" ON "public"."faq_entries" FOR SELECT TO "anon" USING (("published" = true));



CREATE POLICY "Public can read safe system settings" ON "public"."system_settings" FOR SELECT TO "anon" USING (("key" = ANY (ARRAY['site_name'::"text", 'site_description'::"text", 'contact_email'::"text", 'privacy_policy'::"text", 'terms_of_service'::"text"])));



CREATE POLICY "Public can view approved review responses" ON "public"."review_responses" FOR SELECT TO "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."reviews" "r"
  WHERE (("r"."id" = "review_responses"."review_id") AND ("r"."status" = 'approved'::"text")))));



CREATE POLICY "Public can view property schedules" ON "public"."property_schedule" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Service role can create webhook logs" ON "public"."webhook_notification_log" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "Service role can manage analysis results" ON "public"."analysis_results" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage lease clauses" ON "public"."lease_clauses" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage leases" ON "public"."leases" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can read webhook logs" ON "public"."webhook_notification_log" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "System can create notifications" ON "public"."sent_notifications" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "System can insert analysis results" ON "public"."analysis_results" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "System can insert lease clauses" ON "public"."lease_clauses" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "System can update analysis results" ON "public"."analysis_results" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Users can create bookings" ON "public"."bookings" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."proposals" "p"
  WHERE (("p"."id" = "bookings"."proposal_id") AND ("p"."status" = 'accepted'::"text") AND (EXISTS ( SELECT 1
           FROM "public"."inquiries" "i"
          WHERE (("i"."id" = "p"."inquiry_id") AND ("i"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))))));



CREATE POLICY "Users can create inquiries" ON "public"."inquiries" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND (( SELECT "auth"."uid"() AS "uid") IS NOT NULL)));



CREATE POLICY "Users can create messages" ON "public"."messages" FOR INSERT TO "authenticated" WITH CHECK (("inquiry_id" IN ( SELECT "i"."id"
   FROM "public"."inquiries" "i"
  WHERE (("i"."user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
           FROM "public"."properties" "p"
          WHERE (("p"."id" = "i"."property_id") AND (("p"."venue_id" = ( SELECT "auth"."uid"() AS "uid")) OR (("p"."organization_id" IS NOT NULL) AND (EXISTS ( SELECT 1
                   FROM "public"."organization_members" "om"
                  WHERE (("om"."organization_id" = "p"."organization_id") AND ("om"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))))))))));



CREATE POLICY "Users can insert review responses" ON "public"."review_responses" FOR INSERT TO "authenticated" WITH CHECK ((("responder_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."reviews" "r"
  WHERE (("r"."id" = "review_responses"."review_id") AND (EXISTS ( SELECT 1
           FROM "public"."properties" "p"
          WHERE (("p"."id" = "r"."property_id") AND ("p"."venue_id" = ( SELECT "auth"."uid"() AS "uid"))))))))));



CREATE POLICY "Users can manage organization invites" ON "public"."organization_member_invites" TO "authenticated" USING ((("invited_by" = ( SELECT "auth"."uid"() AS "uid")) OR ("organization_id" IN ( SELECT "om"."organization_id"
   FROM "public"."organization_members" "om"
  WHERE (("om"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("om"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))))) WITH CHECK ((("invited_by" = ( SELECT "auth"."uid"() AS "uid")) OR ("organization_id" IN ( SELECT "om"."organization_id"
   FROM "public"."organization_members" "om"
  WHERE (("om"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("om"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"])))))));



CREATE POLICY "Users can manage their organization membership" ON "public"."organization_members" TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (("organization_id" IN ( SELECT "om2"."organization_id"
   FROM "public"."organization_members" "om2"
  WHERE (("om2"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("om2"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))) AND ("role" <> 'owner'::"text")))) WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("organization_id" IN ( SELECT "om2"."organization_id"
   FROM "public"."organization_members" "om2"
  WHERE (("om2"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("om2"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"])))))));



CREATE POLICY "Users can manage their own favorites" ON "public"."favorites" TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can manage their own leases" ON "public"."leases" TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can manage their own reviews" ON "public"."reviews" TO "authenticated" USING (("reviewer_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("reviewer_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can read adjustments" ON "public"."organization_adjustments" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "om"."organization_id"
   FROM "public"."organization_members" "om"
  WHERE ("om"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Users can read relevant proposals" ON "public"."proposals" FOR SELECT TO "authenticated" USING (("inquiry_id" IN ( SELECT "i"."id"
   FROM "public"."inquiries" "i"
  WHERE (("i"."user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
           FROM "public"."properties" "p"
          WHERE (("p"."id" = "i"."property_id") AND (("p"."venue_id" = ( SELECT "auth"."uid"() AS "uid")) OR (("p"."organization_id" IS NOT NULL) AND (EXISTS ( SELECT 1
                   FROM "public"."organization_members" "om"
                  WHERE (("om"."organization_id" = "p"."organization_id") AND ("om"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))))))))));



CREATE POLICY "Users can read their bookings" ON "public"."bookings" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."proposals" "p"
  WHERE (("p"."id" = "bookings"."proposal_id") AND (EXISTS ( SELECT 1
           FROM "public"."inquiries" "i"
          WHERE (("i"."id" = "p"."inquiry_id") AND (EXISTS ( SELECT 1
                   FROM "public"."properties" "pr"
                  WHERE (("pr"."id" = "i"."property_id") AND (("pr"."venue_id" = ( SELECT "auth"."uid"() AS "uid")) OR (("pr"."organization_id" IS NOT NULL) AND (EXISTS ( SELECT 1
                           FROM "public"."organization_members" "om"
                          WHERE (("om"."organization_id" = "pr"."organization_id") AND ("om"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))))))))))))));



CREATE POLICY "Users can read their messages" ON "public"."messages" FOR SELECT TO "authenticated" USING (("inquiry_id" IN ( SELECT "i"."id"
   FROM "public"."inquiries" "i"
  WHERE (("i"."user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
           FROM "public"."properties" "p"
          WHERE (("p"."id" = "i"."property_id") AND (("p"."venue_id" = ( SELECT "auth"."uid"() AS "uid")) OR (("p"."organization_id" IS NOT NULL) AND (EXISTS ( SELECT 1
                   FROM "public"."organization_members" "om"
                  WHERE (("om"."organization_id" = "p"."organization_id") AND ("om"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))))))))));



CREATE POLICY "Users can read their notifications" ON "public"."sent_notifications" FOR SELECT TO "authenticated" USING (("recipient_email" IN ( SELECT "profiles"."email"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Users can update their bookings" ON "public"."bookings" FOR UPDATE TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."proposals" "p"
  WHERE (("p"."id" = "bookings"."proposal_id") AND (EXISTS ( SELECT 1
           FROM "public"."inquiries" "i"
          WHERE (("i"."id" = "p"."inquiry_id") AND (EXISTS ( SELECT 1
                   FROM "public"."properties" "pr"
                  WHERE (("pr"."id" = "i"."property_id") AND (("pr"."venue_id" = ( SELECT "auth"."uid"() AS "uid")) OR (("pr"."organization_id" IS NOT NULL) AND (EXISTS ( SELECT 1
                           FROM "public"."organization_members" "om"
                          WHERE (("om"."organization_id" = "pr"."organization_id") AND ("om"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))))))))))))));



CREATE POLICY "Users can update their organizations" ON "public"."organizations" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "organizations"."id") AND ("om"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("om"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "organizations"."id") AND ("om"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("om"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can view clauses for their own leases" ON "public"."lease_clauses" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."leases" "l"
  WHERE (("l"."id" = "lease_clauses"."lease_id") AND ("l"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can view organizations" ON "public"."organizations" FOR SELECT TO "authenticated" USING (("id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Users can view profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can view their organizations" ON "public"."organizations" FOR SELECT TO "authenticated" USING (("id" IN ( SELECT "om"."organization_id"
   FROM "public"."organization_members" "om"
  WHERE ("om"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



ALTER TABLE "public"."analysis_results" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."faq_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."faq_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."favorites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inquiries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lease_clauses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "oif_delete" ON "public"."organization_inquiry_forms" FOR DELETE TO "authenticated" USING ((("updated_by" = ( SELECT "auth"."uid"() AS "uid")) OR ("organization_id" IN ( SELECT "om"."organization_id"
   FROM "public"."organization_members" "om"
  WHERE (("om"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("om"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"])))))));



CREATE POLICY "oif_insert" ON "public"."organization_inquiry_forms" FOR INSERT TO "authenticated" WITH CHECK ((("updated_by" = ( SELECT "auth"."uid"() AS "uid")) OR ("organization_id" IN ( SELECT "om"."organization_id"
   FROM "public"."organization_members" "om"
  WHERE (("om"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("om"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"])))))));



CREATE POLICY "oif_select" ON "public"."organization_inquiry_forms" FOR SELECT TO "authenticated" USING ((("updated_by" = ( SELECT "auth"."uid"() AS "uid")) OR ("organization_id" IN ( SELECT "om"."organization_id"
   FROM "public"."organization_members" "om"
  WHERE ("om"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "oif_update" ON "public"."organization_inquiry_forms" FOR UPDATE TO "authenticated" USING ((("updated_by" = ( SELECT "auth"."uid"() AS "uid")) OR ("organization_id" IN ( SELECT "om"."organization_id"
   FROM "public"."organization_members" "om"
  WHERE (("om"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("om"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"])))))));



CREATE POLICY "org_credit_ledger_delete" ON "public"."organization_credit_ledger" FOR DELETE TO "authenticated" USING (("organization_id" IN ( SELECT "om"."organization_id"
   FROM "public"."organization_members" "om"
  WHERE (("om"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("om"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "org_credit_ledger_insert" ON "public"."organization_credit_ledger" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" IN ( SELECT "om"."organization_id"
   FROM "public"."organization_members" "om"
  WHERE (("om"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("om"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "org_credit_ledger_select" ON "public"."organization_credit_ledger" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "om"."organization_id"
   FROM "public"."organization_members" "om"
  WHERE ("om"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "org_credit_ledger_update" ON "public"."organization_credit_ledger" FOR UPDATE TO "authenticated" USING (false) WITH CHECK (false);



ALTER TABLE "public"."organization_adjustments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_credit_ledger" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_inquiry_forms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_member_invites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."properties" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."property_availability" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."property_schedule" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."proposals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."review_reminders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "review_reminders_service_role_all" ON "public"."review_reminders" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."review_responses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sent_notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service role manage organizations" ON "public"."organizations" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service role read profiles" ON "public"."profiles" FOR SELECT TO "service_role" USING (true);



ALTER TABLE "public"."system_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."webhook_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."webhook_notification_log" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";


































































































































































































































































































































































































































































































































































































































































































































































GRANT ALL ON FUNCTION "public"."_normalize_slug"("s" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_normalize_slug"("s" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_normalize_slug"("s" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."add_creator_as_org_owner"() TO "anon";
GRANT ALL ON FUNCTION "public"."add_creator_as_org_owner"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_creator_as_org_owner"() TO "service_role";



GRANT ALL ON FUNCTION "public"."add_user_to_primary_org"() TO "anon";
GRANT ALL ON FUNCTION "public"."add_user_to_primary_org"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_user_to_primary_org"() TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_org_service_credit"("p_booking_id" "uuid", "p_payment_intent_id" "text", "p_org_id" "uuid", "p_amount_cents" integer, "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."apply_org_service_credit"("p_booking_id" "uuid", "p_payment_intent_id" "text", "p_org_id" "uuid", "p_amount_cents" integer, "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_org_service_credit"("p_booking_id" "uuid", "p_payment_intent_id" "text", "p_org_id" "uuid", "p_amount_cents" integer, "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."auth_is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."auth_is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auth_is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."claim_pending_inquiry_rpc"("p_property_id" "uuid", "p_user_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_headcount" integer, "p_selected_adjustment_ids" "text"[], "p_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."claim_pending_inquiry_rpc"("p_property_id" "uuid", "p_user_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_headcount" integer, "p_selected_adjustment_ids" "text"[], "p_message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_pending_inquiry_rpc"("p_property_id" "uuid", "p_user_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_headcount" integer, "p_selected_adjustment_ids" "text"[], "p_message" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."claim_pending_inquiry_rpc"("p_property_id" "uuid", "p_user_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_headcount" integer, "p_selected_adjustment_ids" "uuid"[], "p_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."claim_pending_inquiry_rpc"("p_property_id" "uuid", "p_user_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_headcount" integer, "p_selected_adjustment_ids" "uuid"[], "p_message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_pending_inquiry_rpc"("p_property_id" "uuid", "p_user_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_headcount" integer, "p_selected_adjustment_ids" "uuid"[], "p_message" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."claim_pending_inquiry_rpc"("p_property_id" "uuid", "p_user_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone, "p_headcount" integer, "p_selected_adjustment_ids" "text"[], "p_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."claim_pending_inquiry_rpc"("p_property_id" "uuid", "p_user_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone, "p_headcount" integer, "p_selected_adjustment_ids" "text"[], "p_message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_pending_inquiry_rpc"("p_property_id" "uuid", "p_user_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone, "p_headcount" integer, "p_selected_adjustment_ids" "text"[], "p_message" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."claim_pending_inquiry_rpc"("p_property_id" "uuid", "p_user_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone, "p_headcount" integer, "p_selected_adjustment_ids" "uuid"[], "p_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."claim_pending_inquiry_rpc"("p_property_id" "uuid", "p_user_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone, "p_headcount" integer, "p_selected_adjustment_ids" "uuid"[], "p_message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_pending_inquiry_rpc"("p_property_id" "uuid", "p_user_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone, "p_headcount" integer, "p_selected_adjustment_ids" "uuid"[], "p_message" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_edge_rate_limits"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_edge_rate_limits"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_edge_rate_limits"() TO "service_role";



GRANT ALL ON FUNCTION "public"."convert_invites_for_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."convert_invites_for_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."convert_invites_for_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_booking_calendar_attachment"("booking_id" "text", "property_title" "text", "start_date" "date", "end_date" "date", "location" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_booking_calendar_attachment"("booking_id" "text", "property_title" "text", "start_date" "date", "end_date" "date", "location" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_booking_calendar_attachment"("booking_id" "text", "property_title" "text", "start_date" "date", "end_date" "date", "location" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_booking_calendar_attachment_v2"("booking_id" "text", "property_title" "text", "start_date" "date", "end_date" "date", "location" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_booking_calendar_attachment_v2"("booking_id" "text", "property_title" "text", "start_date" "date", "end_date" "date", "location" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_booking_calendar_attachment_v2"("booking_id" "text", "property_title" "text", "start_date" "date", "end_date" "date", "location" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_booking_calendar_attachment_v3"("booking_id" "text", "property_title" "text", "start_date" "date", "end_date" "date", "location" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_booking_calendar_attachment_v3"("booking_id" "text", "property_title" "text", "start_date" "date", "end_date" "date", "location" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_booking_calendar_attachment_v3"("booking_id" "text", "property_title" "text", "start_date" "date", "end_date" "date", "location" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_booking_calendar_attachment_v4"("booking_id" "text", "location" "text", "property_title" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_booking_calendar_attachment_v4"("booking_id" "text", "location" "text", "property_title" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_booking_calendar_attachment_v4"("booking_id" "text", "location" "text", "property_title" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_booking_calendar_attachment_v4"("booking_id" "text", "property_title" "text", "start_date" "date", "end_date" "date", "location" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_booking_calendar_attachment_v4"("booking_id" "text", "property_title" "text", "start_date" "date", "end_date" "date", "location" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_booking_calendar_attachment_v4"("booking_id" "text", "property_title" "text", "start_date" "date", "end_date" "date", "location" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_booking_calendar_attachment_v5"("booking_id" "text", "property_title" "text", "start_date" "date", "end_date" "date", "location" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_booking_calendar_attachment_v5"("booking_id" "text", "property_title" "text", "start_date" "date", "end_date" "date", "location" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_booking_calendar_attachment_v5"("booking_id" "text", "property_title" "text", "start_date" "date", "end_date" "date", "location" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_booking_calendar_attachment_v6"("booking_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_booking_calendar_attachment_v6"("booking_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_booking_calendar_attachment_v6"("booking_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_booking_calendar_attachment_v6"("booking_id" "text", "location" "text", "property_title" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_booking_calendar_attachment_v6"("booking_id" "text", "location" "text", "property_title" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_booking_calendar_attachment_v6"("booking_id" "text", "location" "text", "property_title" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_booking_calendar_attachment_v6"("booking_id" "text", "property_title" "text", "start_date" "date", "end_date" "date", "location" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_booking_calendar_attachment_v6"("booking_id" "text", "property_title" "text", "start_date" "date", "end_date" "date", "location" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_booking_calendar_attachment_v6"("booking_id" "text", "property_title" "text", "start_date" "date", "end_date" "date", "location" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_booking_ics_attachment"("booking_id" "uuid", "property_title" "text", "start_date" "date", "end_date" "date", "location" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_booking_ics_attachment"("booking_id" "uuid", "property_title" "text", "start_date" "date", "end_date" "date", "location" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_booking_ics_attachment"("booking_id" "uuid", "property_title" "text", "start_date" "date", "end_date" "date", "location" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_ics_calendar_content"("event_title" "text", "start_date" "date", "end_date" "date", "location" "text", "description" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_ics_calendar_content"("event_title" "text", "start_date" "date", "end_date" "date", "location" "text", "description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_ics_calendar_content"("event_title" "text", "start_date" "date", "end_date" "date", "location" "text", "description" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_ics_calendar_content_v3"("event_title" "text", "start_date" "date", "end_date" "date", "location" "text", "description" "text", "is_all_day" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."create_ics_calendar_content_v3"("event_title" "text", "start_date" "date", "end_date" "date", "location" "text", "description" "text", "is_all_day" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_ics_calendar_content_v3"("event_title" "text", "start_date" "date", "end_date" "date", "location" "text", "description" "text", "is_all_day" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_ics_calendar_content_v4"("event_title" "text", "start_date" "date", "end_date" "date", "location" "text", "description" "text", "is_all_day" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."create_ics_calendar_content_v4"("event_title" "text", "start_date" "date", "end_date" "date", "location" "text", "description" "text", "is_all_day" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_ics_calendar_content_v4"("event_title" "text", "start_date" "date", "end_date" "date", "location" "text", "description" "text", "is_all_day" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_ics_calendar_content_v5"("event_title" "text", "start_date" "date", "end_date" "date", "location" "text", "description" "text", "uid" "text", "is_all_day" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."create_ics_calendar_content_v5"("event_title" "text", "start_date" "date", "end_date" "date", "location" "text", "description" "text", "uid" "text", "is_all_day" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_ics_calendar_content_v5"("event_title" "text", "start_date" "date", "end_date" "date", "location" "text", "description" "text", "uid" "text", "is_all_day" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."debug_user_org_membership"() TO "anon";
GRANT ALL ON FUNCTION "public"."debug_user_org_membership"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."debug_user_org_membership"() TO "service_role";



GRANT ALL ON FUNCTION "public"."dequeue_due_review_reminders"("p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."dequeue_due_review_reminders"("p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dequeue_due_review_reminders"("p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."encode_ics_content"("ics_content" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."encode_ics_content"("ics_content" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."encode_ics_content"("ics_content" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."encode_ics_content_safely"("ics_content" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."encode_ics_content_safely"("ics_content" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."encode_ics_content_safely"("ics_content" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_non_negative_service_credit"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_non_negative_service_credit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_non_negative_service_credit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."faq_entries_tsv_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."faq_entries_tsv_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."faq_entries_tsv_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fix_missing_org_memberships"() TO "anon";
GRANT ALL ON FUNCTION "public"."fix_missing_org_memberships"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fix_missing_org_memberships"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fix_webhook_property_query"() TO "anon";
GRANT ALL ON FUNCTION "public"."fix_webhook_property_query"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fix_webhook_property_query"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_ics_calendar_content"("title" "text", "start_date" "date", "end_date" "date", "location" "text", "description" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_ics_calendar_content"("title" "text", "start_date" "date", "end_date" "date", "location" "text", "description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_ics_calendar_content"("title" "text", "start_date" "date", "end_date" "date", "location" "text", "description" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_frontend_base_url"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_frontend_base_url"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_frontend_base_url"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_timezone_names"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_timezone_names"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_timezone_names"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_inquiry_for_user"("p_property_id" "uuid", "p_user_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone, "p_headcount" integer, "p_selected_adjustment_ids" "uuid"[], "p_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."insert_inquiry_for_user"("p_property_id" "uuid", "p_user_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone, "p_headcount" integer, "p_selected_adjustment_ids" "uuid"[], "p_message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_inquiry_for_user"("p_property_id" "uuid", "p_user_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone, "p_headcount" integer, "p_selected_adjustment_ids" "uuid"[], "p_message" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_org_admin"("org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_org_admin"("org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_org_admin"("org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_org_member"("org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_org_member"("org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_org_member"("org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_org_member_with_role"("org_id" "uuid", "allowed_roles" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."is_org_member_with_role"("org_id" "uuid", "allowed_roles" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_org_member_with_role"("org_id" "uuid", "allowed_roles" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_platform_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_platform_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_platform_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_notification_attempt"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_notification_attempt"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_notification_attempt"() TO "service_role";



GRANT ALL ON FUNCTION "public"."organizations_set_defaults"() TO "anon";
GRANT ALL ON FUNCTION "public"."organizations_set_defaults"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."organizations_set_defaults"() TO "service_role";



GRANT ALL ON FUNCTION "public"."promote_invites_for_email"("p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."promote_invites_for_email"("p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."promote_invites_for_email"("p_email" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."refresh_timezone_cache"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."refresh_timezone_cache"() TO "service_role";



GRANT ALL ON FUNCTION "public"."review_reminders_handle_review_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."review_reminders_handle_review_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."review_reminders_handle_review_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."review_reminders_handle_review_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."review_reminders_handle_review_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."review_reminders_handle_review_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."safe_encode_base64_text"("input_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."safe_encode_base64_text"("input_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."safe_encode_base64_text"("input_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."schedule_review_reminder_for_booking"() TO "anon";
GRANT ALL ON FUNCTION "public"."schedule_review_reminder_for_booking"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."schedule_review_reminder_for_booking"() TO "service_role";



GRANT ALL ON FUNCTION "public"."send_payment_confirmation_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."send_payment_confirmation_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."send_payment_confirmation_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."send_payment_request_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."send_payment_request_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."send_payment_request_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."slugify"("txt" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."slugify"("txt" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."slugify"("txt" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_organization_members_set_primary"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_organization_members_set_primary"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_organization_members_set_primary"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_profiles_ensure_org_membership"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_profiles_ensure_org_membership"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_profiles_ensure_org_membership"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_set_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_set_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_set_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."uid"() TO "anon";
GRANT ALL ON FUNCTION "public"."uid"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."uid"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_inquiry_status_on_payment"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_inquiry_status_on_payment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_inquiry_status_on_payment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_property_reviews_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_property_reviews_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_property_reviews_stats"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_property_search_stats"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_property_search_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_email_attachment_object"("content" "text", "name" "text", "content_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_email_attachment_object"("content" "text", "name" "text", "content_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_email_attachment_object"("content" "text", "name" "text", "content_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_review_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_review_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_review_status"() TO "service_role";
























GRANT MAINTAIN ON TABLE "public"."analysis_results" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."analysis_results" TO "authenticated";
GRANT ALL ON TABLE "public"."analysis_results" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."bookings" TO "anon";
GRANT ALL ON TABLE "public"."bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."bookings" TO "service_role";



GRANT ALL ON TABLE "public"."cached_timezone_names" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."edge_rate_limits" TO "anon";
GRANT MAINTAIN ON TABLE "public"."edge_rate_limits" TO "authenticated";
GRANT MAINTAIN ON TABLE "public"."edge_rate_limits" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."faq_categories" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."faq_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."faq_categories" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."faq_entries" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."faq_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."faq_entries" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."favorites" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN ON TABLE "public"."favorites" TO "authenticated";
GRANT MAINTAIN ON TABLE "public"."favorites" TO "service_role";



GRANT ALL ON TABLE "public"."import_datamining" TO "anon";
GRANT ALL ON TABLE "public"."import_datamining" TO "authenticated";
GRANT ALL ON TABLE "public"."import_datamining" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."inquiries" TO "anon";
GRANT ALL ON TABLE "public"."inquiries" TO "authenticated";
GRANT ALL ON TABLE "public"."inquiries" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."lease_clauses" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."lease_clauses" TO "authenticated";
GRANT ALL ON TABLE "public"."lease_clauses" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."leases" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."leases" TO "authenticated";
GRANT ALL ON TABLE "public"."leases" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."organization_adjustments" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."organization_adjustments" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_adjustments" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."organization_credit_ledger" TO "anon";
GRANT MAINTAIN ON TABLE "public"."organization_credit_ledger" TO "authenticated";
GRANT MAINTAIN ON TABLE "public"."organization_credit_ledger" TO "service_role";



GRANT ALL ON TABLE "public"."organization_inquiry_forms" TO "anon";
GRANT ALL ON TABLE "public"."organization_inquiry_forms" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_inquiry_forms" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."organization_member_invites" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."organization_member_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_member_invites" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."organization_members" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."organization_members" TO "authenticated";
GRANT MAINTAIN ON TABLE "public"."organization_members" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."organizations" TO "anon";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."pages" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."pages" TO "authenticated";
GRANT ALL ON TABLE "public"."pages" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."profiles" TO "anon";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT,MAINTAIN ON TABLE "public"."profiles" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."properties" TO "anon";
GRANT ALL ON TABLE "public"."properties" TO "authenticated";
GRANT ALL ON TABLE "public"."properties" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."property_availability" TO "anon";
GRANT MAINTAIN ON TABLE "public"."property_availability" TO "authenticated";
GRANT MAINTAIN ON TABLE "public"."property_availability" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."property_schedule" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."property_schedule" TO "authenticated";
GRANT ALL ON TABLE "public"."property_schedule" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."proposals" TO "anon";
GRANT ALL ON TABLE "public"."proposals" TO "authenticated";
GRANT ALL ON TABLE "public"."proposals" TO "service_role";



GRANT ALL ON TABLE "public"."review_reminders" TO "anon";
GRANT ALL ON TABLE "public"."review_reminders" TO "authenticated";
GRANT ALL ON TABLE "public"."review_reminders" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."review_responses" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."review_responses" TO "authenticated";
GRANT MAINTAIN ON TABLE "public"."review_responses" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."reviews" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."reviews" TO "authenticated";
GRANT MAINTAIN ON TABLE "public"."reviews" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."sent_notifications" TO "anon";
GRANT ALL ON TABLE "public"."sent_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."sent_notifications" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."system_settings" TO "anon";
GRANT SELECT,MAINTAIN,UPDATE ON TABLE "public"."system_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."system_settings" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."webhook_logs" TO "anon";
GRANT MAINTAIN ON TABLE "public"."webhook_logs" TO "authenticated";
GRANT MAINTAIN ON TABLE "public"."webhook_logs" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."webhook_notification_log" TO "anon";
GRANT ALL ON TABLE "public"."webhook_notification_log" TO "authenticated";
GRANT ALL ON TABLE "public"."webhook_notification_log" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
































--
-- Dumped schema changes for auth and storage
--

CREATE OR REPLACE TRIGGER "on_auth_user_created" AFTER INSERT ON "auth"."users" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user"();



CREATE POLICY "Property images are publicly accessible" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'property-images'::"text"));



CREATE POLICY "Users can delete their own lease documents" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'lease-documents'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));



CREATE POLICY "Users can delete their own property images" ON "storage"."objects" FOR DELETE USING ((("bucket_id" = 'property-images'::"text") AND ("auth"."uid"() = "owner")));



CREATE POLICY "Users can update their own lease documents" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'lease-documents'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1]))) WITH CHECK ((("bucket_id" = 'lease-documents'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));



CREATE POLICY "Users can update their own property images" ON "storage"."objects" FOR UPDATE USING ((("bucket_id" = 'property-images'::"text") AND ("auth"."uid"() = "owner")));



CREATE POLICY "Users can upload property images" ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = 'property-images'::"text") AND ("auth"."role"() = 'authenticated'::"text")));



CREATE POLICY "Users can upload their own lease documents" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'lease-documents'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));



CREATE POLICY "Users can view their own lease documents" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'lease-documents'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));



