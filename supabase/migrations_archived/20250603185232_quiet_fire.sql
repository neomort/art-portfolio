/*
  # Add Messages Table

  1. New Tables
    - `messages`
      - `id` (uuid, primary key)
      - `inquiry_id` (uuid, references inquiries)
      - `sender_id` (uuid, references profiles)
      - `content` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on messages table
    - Add policies for message access
*/

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id uuid NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view messages for their inquiries"
  ON messages
  FOR SELECT
  TO authenticated
  USING (
    sender_id = auth.uid() OR 
    inquiry_id IN (
      SELECT id FROM inquiries WHERE 
        user_id = auth.uid() OR 
        property_id IN (
          SELECT id FROM properties WHERE venue_id = auth.uid()
        )
    )
  );

CREATE POLICY "Users can send messages for their inquiries"
  ON messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    inquiry_id IN (
      SELECT id FROM inquiries WHERE 
        user_id = auth.uid() OR 
        property_id IN (
          SELECT id FROM properties WHERE venue_id = auth.uid()
        )
    )
  );