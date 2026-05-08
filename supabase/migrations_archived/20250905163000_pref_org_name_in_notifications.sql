-- Prefer organizations.name over profiles.full_name in notification triggers
BEGIN;

-- 1) send_payment_request_notification: prefer org name for venue owner display
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
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.send_payment_request_notification() IS 'Uses organization name when available for venue owner; falls back to profile full_name.';

-- 2) send_payment_confirmation_notification: prefer org name for venue owner display
CREATE OR REPLACE FUNCTION public.send_payment_confirmation_notification()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.send_payment_confirmation_notification() IS 'Uses organization name when available for venue owner; falls back to profile full_name.';

COMMIT;
