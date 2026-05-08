/*
  # Add property availability features

  1. New Tables
    - `property_schedule`
      - `id` (uuid, primary key)
      - `property_id` (uuid, references properties)
      - `available_from` (date, nullable)
      - `available_until` (date, nullable)
      - `daily_schedule` (jsonb, stores weekly schedule)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Changes
    - Add cascade deletion for property schedules
    - Add indexes for date range queries
    
  3. Security
    - Enable RLS
    - Add policies for public viewing
    - Add policies for owner management
*/

CREATE TABLE IF NOT EXISTS property_schedule (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    available_from date,
    available_until date,
    daily_schedule jsonb NOT NULL DEFAULT '{
        "monday": {"enabled": true, "start": "09:00", "end": "17:00"},
        "tuesday": {"enabled": true, "start": "09:00", "end": "17:00"},
        "wednesday": {"enabled": true, "start": "09:00", "end": "17:00"},
        "thursday": {"enabled": true, "start": "09:00", "end": "17:00"},
        "friday": {"enabled": true, "start": "09:00", "end": "17:00"},
        "saturday": {"enabled": false, "start": "09:00", "end": "17:00"},
        "sunday": {"enabled": false, "start": "09:00", "end": "17:00"}
    }'::jsonb,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create index for date range queries
CREATE INDEX idx_property_schedule_dates ON property_schedule (property_id, available_from, available_until);

-- Enable RLS
ALTER TABLE property_schedule ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Property schedules are publicly viewable"
    ON property_schedule FOR SELECT
    USING (true);

CREATE POLICY "Property owners can manage schedules"
    ON property_schedule FOR ALL
    USING (
        auth.uid() IN (
            SELECT venue_id FROM properties WHERE id = property_id
        )
    )
    WITH CHECK (
        auth.uid() IN (
            SELECT venue_id FROM properties WHERE id = property_id
        )
    );

-- Create updated_at trigger
CREATE TRIGGER update_property_schedule_updated_at
    BEFORE UPDATE ON property_schedule
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();