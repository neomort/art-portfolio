/*
  # Create pages table for CMS

  1. New Tables
    - `pages` - Stores static page content
      - `id` (uuid, primary key)
      - `slug` (text, unique)
      - `title` (text)
      - `content` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
  
  2. Security
    - Enable RLS on `pages` table
    - Public read access for all pages
    - Admin-only write access (insert, update, delete)
*/

-- Create pages table
CREATE TABLE public.pages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE,
    title text NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;

-- Create policies for pages table
-- Allow public read access
CREATE POLICY "Pages are viewable by everyone" ON public.pages
FOR SELECT USING (true);

-- Allow authenticated admins to insert pages
CREATE POLICY "Admins can insert pages" ON public.pages
FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Allow authenticated admins to update pages
CREATE POLICY "Admins can update pages" ON public.pages
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Allow authenticated admins to delete pages
CREATE POLICY "Admins can delete pages" ON public.pages
FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Create a trigger to update the 'updated_at' column on each update
CREATE TRIGGER update_pages_updated_at
BEFORE UPDATE ON public.pages
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();