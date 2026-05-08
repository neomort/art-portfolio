/*
  # Update Email Sender Configuration
  
  1. New Tables
    - `system_settings` - Stores global system configuration values
      - `id` (uuid, primary key)
      - `key` (text, unique)
      - `value` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
  
  2. Security
    - Enable RLS on `system_settings` table
    - Add policy for admins to manage settings
    - Add policy for public to read settings
*/

-- Create system_settings table for global configuration
CREATE TABLE IF NOT EXISTS public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for system_settings table
CREATE POLICY "Admins can manage system settings"
  ON public.system_settings
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  ));

CREATE POLICY "Public can read system settings"
  ON public.system_settings
  FOR SELECT
  TO public
  USING (true);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default email sender configuration
INSERT INTO public.system_settings (key, value)
VALUES ('email_sender', 'support@splitspace.com')
ON CONFLICT (key) DO UPDATE SET value = 'support@splitspace.com';