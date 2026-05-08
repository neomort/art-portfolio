-- Replace send_payment_confirmation_notification() to remove dependency on owner.company_name
-- After migrating company/brand fields to organizations, profiles.company_name no longer exists.
-- This update uses profiles.full_name for the venue owner name. Optionally, later we can enrich with organizations.name.

BEGIN;

-- Recreate function without referencing owner.company_name
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
        
        -- Get property title and venue owner information (profiles.full_name only)
        SELECT 
          prop.title,
          owner.email,
          owner.full_name
        INTO 
          v_property_title,
          v_venue_owner_email,
          v_venue_owner_name
        FROM public.properties prop
        JOIN public.profiles owner ON prop.venue_id = owner.id
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

COMMENT ON FUNCTION public.send_payment_confirmation_notification() IS 'Updated to remove dependency on profiles.company_name; uses profiles.full_name for owner name.';

COMMIT;
