/*
  # Fix webhook notification queries

  1. Changes
    - Add webhook_logs table for better debugging
    - Add system setting for tracking webhook notification status
*/

-- Create webhook_logs table for better debugging
CREATE TABLE IF NOT EXISTS webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text,
  event_id text,
  payment_intent_id text,
  booking_id text,
  status text,
  error text,
  request_body text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

-- Add policy for admins to view webhook logs
CREATE POLICY "Admins can view webhook logs"
  ON webhook_logs
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  ));

-- Add a new system setting for webhook notification tracking
INSERT INTO system_settings (key, value)
VALUES ('webhook_notification_status', '{"lastSuccess":null,"lastError":null,"errorCount":0}')
ON CONFLICT (key) DO NOTHING;