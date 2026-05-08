/*
  # Fix storage policies type casting

  1. Changes
    - Fix type casting in storage policies to handle UUID and text comparisons correctly
    - Ensure bucket creation is idempotent
    - Recreate policies with proper type handling

  2. Security
    - Maintain existing security model with proper type handling
    - Public read access for property images
    - Authenticated users can upload images
    - Users can only update/delete their own images
*/

-- Recreate bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-images', 'property-images', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies
DROP POLICY IF EXISTS "Property images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload property images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own property images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own property images" ON storage.objects;

-- Recreate policies with correct type casting
CREATE POLICY "Property images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'property-images');

CREATE POLICY "Users can upload property images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'property-images'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can update their own property images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'property-images'
  AND auth.uid() = owner::uuid
);

CREATE POLICY "Users can delete their own property images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'property-images'
  AND auth.uid() = owner::uuid
);