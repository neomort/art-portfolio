-- Replace send_payment_request_notification() to remove dependency on profiles.company_name
-- After migrating company name to organizations, profiles.company_name no longer exists.
-- This update uses profiles.full_name for venue owner name. Optionally we can later switch to organizations.name.

BEGIN;

CREATE OR REPLACE FUNCTION public.send_payment_request_notification()
RETURNS TRIGGER AS $$
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
  
  -- Get venue owner name (profiles.full_name only; no longer uses profiles.company_name)
  SELECT 
    full_name
  INTO v_venue_owner_name
  FROM public.profiles
  WHERE id = v_inquiry_data.venue_id;
  
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
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.send_payment_request_notification() IS 'Updated to remove dependency on profiles.company_name; uses profiles.full_name instead.';

COMMIT;
