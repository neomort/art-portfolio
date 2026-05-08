/*
  # Fix webhook notification issues

  1. New Tables
    - None
  
  2. Changes
    - Add webhook_notification_log table for detailed notification debugging
    - Add webhook_notification_status system setting
  
  3. Security
    - Enable RLS on webhook_notification_log
    - Add policy for admins to view logs
*/

-- Create webhook_notification_log table for detailed notification debugging
CREATE TABLE IF NOT EXISTS webhook_notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_intent_id text,
  booking_id text,
  notification_type text,
  recipient_email text,
  recipient_name text,
  status text,
  error text,
  response_data jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE webhook_notification_log ENABLE ROW LEVEL SECURITY;

-- Add policy for admins to view webhook logs
CREATE POLICY "Admins can view webhook notification logs"
  ON webhook_notification_log
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  ));

-- Add a new system setting for webhook notification tracking
INSERT INTO system_settings (key, value)
VALUES ('webhook_notification_status', '{"lastSuccess":null,"lastError":null,"errorCount":0,"lastErrorMessage":null}')
ON CONFLICT (key) DO NOTHING;