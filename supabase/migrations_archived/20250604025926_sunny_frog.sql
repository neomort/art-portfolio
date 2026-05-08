/*
  # Add Reviews and Ratings System

  1. New Tables
    - `reviews`
      - `id` (uuid, primary key)
      - `property_id` (uuid, references properties)
      - `reviewer_id` (uuid, references profiles)
      - `rating` (integer, 1-5)
      - `content` (text, 20-1000 chars)
      - `verified_booking` (boolean)
      - `review_eligibility` (jsonb)
      - `status` (text: pending/approved/rejected)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `review_responses`
      - `id` (uuid, primary key)
      - `review_id` (uuid, references reviews)
      - `responder_id` (uuid, references profiles)
      - `content` (text, max 1000 chars)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for public viewing
    - Add policies for creating/managing reviews
    - Add policies for owner responses

  3. Triggers
    - Add updated_at triggers
    - Add review status validation trigger
*/

-- Create reviews table
CREATE TABLE reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES profiles(id),
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  content text NOT NULL CHECK (length(content) >= 20 AND length(content) <= 1000),
  verified_booking boolean NOT NULL DEFAULT false,
  review_eligibility jsonb NOT NULL DEFAULT '{
    "completed_booking": false,
    "payment_status": "none",
    "booking_id": null,
    "inquiry_id": null
  }'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create review_responses table
CREATE TABLE review_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  responder_id uuid NOT NULL REFERENCES profiles(id),
  content text NOT NULL CHECK (length(content) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_responses ENABLE ROW LEVEL SECURITY;

-- Create policies for reviews
CREATE POLICY "Reviews are viewable by everyone"
  ON reviews
  FOR SELECT
  USING (true);

CREATE POLICY "Users can create reviews for properties they've interacted with"
  ON reviews
  FOR INSERT
  WITH CHECK (
    reviewer_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM inquiries
      WHERE property_id = reviews.property_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own reviews"
  ON reviews
  FOR UPDATE
  USING (reviewer_id = auth.uid())
  WITH CHECK (reviewer_id = auth.uid());

CREATE POLICY "Users can delete their own reviews"
  ON reviews
  FOR DELETE
  USING (reviewer_id = auth.uid());

-- Create policies for review responses
CREATE POLICY "Review responses are viewable by everyone"
  ON review_responses
  FOR SELECT
  USING (true);

CREATE POLICY "Property owners can respond to reviews"
  ON review_responses
  FOR INSERT
  WITH CHECK (
    responder_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM reviews r
      JOIN properties p ON r.property_id = p.id
      WHERE r.id = review_responses.review_id
      AND p.venue_id = auth.uid()
    )
  );

CREATE POLICY "Property owners can update their responses"
  ON review_responses
  FOR UPDATE
  USING (responder_id = auth.uid())
  WITH CHECK (responder_id = auth.uid());

-- Create updated_at triggers
CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_review_responses_updated_at
  BEFORE UPDATE ON review_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add review status validation trigger
CREATE OR REPLACE FUNCTION validate_review_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Only allow status changes by property owners
  IF OLD.status != NEW.status AND NOT EXISTS (
    SELECT 1 FROM properties
    WHERE id = NEW.property_id
    AND venue_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only property owners can change review status';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_review_status
  BEFORE UPDATE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION validate_review_status();

-- Add indexes for performance
CREATE INDEX idx_reviews_property_id ON reviews(property_id);
CREATE INDEX idx_reviews_reviewer_id ON reviews(reviewer_id);
CREATE INDEX idx_reviews_rating ON reviews(rating);
CREATE INDEX idx_reviews_status ON reviews(status);
CREATE INDEX idx_review_responses_review_id ON review_responses(review_id);