/*
  # Pin search_path on existing deployed functions

  This migration enforces SET search_path = pg_catalog, public on existing functions
  that are SECURITY DEFINER or are commonly invoked by SECURITY DEFINER code.
  It uses full function signatures to avoid ambiguity, and is safe to run multiple times.
*/

-- Helper: set search_path for a function if it exists. Ignores missing functions.
CREATE OR REPLACE FUNCTION public.__set_search_path_if_exists(p_signature text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  rp regprocedure;
BEGIN
  SELECT to_regprocedure(p_signature) INTO rp;
  IF rp IS NULL THEN
    RETURN;
  END IF;
  EXECUTE format('ALTER FUNCTION %s SET search_path = pg_catalog, public', rp);
END;
$$;

-- ICS content generators
SELECT public.__set_search_path_if_exists('public.create_ics_calendar_content_v3(text, date, date, text, text, boolean)');
SELECT public.__set_search_path_if_exists('public.create_ics_calendar_content_v4(text, date, date, text, text, boolean)');
SELECT public.__set_search_path_if_exists('public.create_ics_calendar_content_v5(text, date, date, text, text, text, boolean)');

-- Calendar attachment creators
SELECT public.__set_search_path_if_exists('public.create_booking_calendar_attachment(text, text, date, date, text)');
SELECT public.__set_search_path_if_exists('public.create_booking_calendar_attachment_v2(text, text, date, date, text)');
SELECT public.__set_search_path_if_exists('public.create_booking_calendar_attachment_v3(text, text, date, date, text)');
SELECT public.__set_search_path_if_exists('public.create_booking_calendar_attachment_v4(text, text, date, date, text)');
SELECT public.__set_search_path_if_exists('public.create_booking_calendar_attachment_v4(text, text, text)');
SELECT public.__set_search_path_if_exists('public.create_booking_calendar_attachment_v5(text, text, date, date, text)');
SELECT public.__set_search_path_if_exists('public.create_booking_calendar_attachment_v6(text)');
SELECT public.__set_search_path_if_exists('public.create_booking_calendar_attachment_v6(text, text, text)');
SELECT public.__set_search_path_if_exists('public.create_booking_calendar_attachment_v6(text, text, date, date, text)');
SELECT public.__set_search_path_if_exists('public.create_booking_ics_attachment(uuid, text, date, date, text)');

-- Encoding/utilities
SELECT public.__set_search_path_if_exists('public.encode_ics_content(text)');
SELECT public.__set_search_path_if_exists('public.encode_ics_content_safely(text)');
SELECT public.__set_search_path_if_exists('public.safe_encode_base64_text(text)');
SELECT public.__set_search_path_if_exists('public.get_frontend_base_url()');
SELECT public.__set_search_path_if_exists('public.fix_webhook_property_query()');
SELECT public.__set_search_path_if_exists('public.generate_ics_calendar_content(text, date, date, text, text)');

-- Additional functions flagged by advisor (non-SECURITY DEFINER)
SELECT public.__set_search_path_if_exists('public.create_ics_calendar_content(text, date, date, text, text)');
SELECT public.__set_search_path_if_exists('public.enforce_non_negative_service_credit()');
SELECT public.__set_search_path_if_exists('public.faq_entries_tsv_trigger()');
SELECT public.__set_search_path_if_exists('public.send_payment_confirmation_notification()');
SELECT public.__set_search_path_if_exists('public.send_payment_request_notification()');
SELECT public.__set_search_path_if_exists('public.update_updated_at_column()');
SELECT public.__set_search_path_if_exists('public.validate_review_status()');
SELECT public.__set_search_path_if_exists('public.validate_email_attachment_object(text, text, text)');

-- Triggers
SELECT public.__set_search_path_if_exists('public.handle_new_user()');
SELECT public.__set_search_path_if_exists('public.log_notification_attempt()');
SELECT public.__set_search_path_if_exists('public.update_inquiry_status_on_payment()');

-- Maintenance
SELECT public.__set_search_path_if_exists('public.cleanup_edge_rate_limits()');

-- Cleanup helper to keep schema tidy
DROP FUNCTION IF EXISTS public.__set_search_path_if_exists(text);
