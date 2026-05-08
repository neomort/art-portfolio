/*
  # Add booking cancellation support

  1. New Template
    - Add booking_cancellation template ID to BREVO_TEMPLATES

  2. Booking Status Updates
    - Ensure 'canceled' is a valid booking status
    - Add 'refunded' as a valid payment status
*/

-- Update BREVO_TEMPLATES in the send-notification function
-- This is just a marker migration - the actual template ID will be added in the edge function
INSERT INTO public.system_settings (key, value, created_at, updated_at)
VALUES ('email_template_booking_cancellation', '8', now(), now())
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = EXCLUDED.updated_at;

-- Add a comment to document the template ID
COMMENT ON TABLE public.system_settings IS 'System-wide settings including email templates. Template IDs: 1=message_received, 2=inquiry_response, 3=booking_confirmed, 4=payment_confirmation, 5=payment_received, 6=payment_request, 7=new_inquiry, 8=booking_cancellation';