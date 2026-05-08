-- Update send_payment_request_notification() to use organizations.name when available
-- Falls back to profiles.full_name if org name is not present

BEGIN;

CREATE OR REPLACE FUNCTION public.send_payment_request_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_inquiry_data RECORD;
  v_customer_email TEXT;
  v_customer_name TEXT;
  v_property_title TEXT;
  v_venue_owner_name TEXT;
  v_org_name TEXT;
  v_request_id TEXT;
BEGIN
  -- Get inquiry data with related property (including organization_id)
  SELECT 
    i.id AS inquiry_id,
    i.user_id,
    p.title AS property_title,
    p.venue_id,
    p.organization_id
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
  
  -- Prefer organization name
  IF v_inquiry_data.organization_id IS NOT NULL THEN
    SELECT name INTO v_org_name
    FROM public.organizations
    WHERE id = v_inquiry_data.organization_id;
  END IF;

  -- Get venue owner full name as fallback
  SELECT full_name
  INTO v_venue_owner_name
  FROM public.profiles
  WHERE id = v_inquiry_data.venue_id;

  -- Compose display name
  v_venue_owner_name := COALESCE(v_org_name, v_venue_owner_name);
  
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

COMMENT ON FUNCTION public.send_payment_request_notification() IS 'Uses organizations.name (if available) for venue owner name, falls back to profiles.full_name.';

COMMIT;
