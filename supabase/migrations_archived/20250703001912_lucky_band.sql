/*
  # Create Pages Table for CMS
  
  1. New Tables
    - `pages` - Stores CMS pages with slug, title, and content
  2. Security
    - Enable RLS on `pages` table
    - Add policies for public viewing and admin management
  3. Performance
    - Add unique index on slug field
    - Add trigger for automatic updated_at timestamp
*/

-- Create the pages table
CREATE TABLE IF NOT EXISTS pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;

-- Create policies for pages table
-- Note: PostgreSQL doesn't support IF NOT EXISTS for policies
-- We'll use DO blocks to check if policies exist before creating them

-- Policy for public viewing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'pages' AND policyname = 'Pages are viewable by everyone'
  ) THEN
    CREATE POLICY "Pages are viewable by everyone"
      ON pages
      FOR SELECT
      TO public
      USING (true);
  END IF;
END
$$;

-- Policy for admin insertion
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'pages' AND policyname = 'Admins can insert pages'
  ) THEN
    CREATE POLICY "Admins can insert pages"
      ON pages
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.is_admin = true
        )
      );
  END IF;
END
$$;

-- Policy for admin updates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'pages' AND policyname = 'Admins can update pages'
  ) THEN
    CREATE POLICY "Admins can update pages"
      ON pages
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.is_admin = true
        )
      );
  END IF;
END
$$;

-- Policy for admin deletion
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'pages' AND policyname = 'Admins can delete pages'
  ) THEN
    CREATE POLICY "Admins can delete pages"
      ON pages
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.is_admin = true
        )
      );
  END IF;
END
$$;

-- Create trigger to update updated_at timestamp
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_pages_updated_at'
  ) THEN
    CREATE TRIGGER update_pages_updated_at
      BEFORE UPDATE ON pages
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END
$$;

-- Create index on slug for faster lookups
CREATE UNIQUE INDEX IF NOT EXISTS pages_slug_key ON pages USING btree (slug);