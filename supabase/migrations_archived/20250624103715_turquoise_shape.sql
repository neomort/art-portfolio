/*
  # Create favorites table

  1. New Tables
    - `favorites`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `property_id` (uuid, references properties)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on favorites table
    - Add policies for users to manage their own favorites
*/

-- Create the favorites table
CREATE TABLE IF NOT EXISTS public.favorites (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON public.favorites USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_property_id ON public.favorites USING btree (property_id);

-- Create unique constraint to prevent duplicate favorites
CREATE UNIQUE INDEX IF NOT EXISTS unique_user_property_favorite ON public.favorites USING btree (user_id, property_id);

-- RLS Policies - Only create if they don't exist
DO $$
BEGIN
    -- Check if the INSERT policy exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'favorites' 
        AND policyname = 'Users can add their own favorites'
    ) THEN
        CREATE POLICY "Users can add their own favorites"
            ON public.favorites
            FOR INSERT
            TO authenticated
            WITH CHECK (auth.uid() = user_id);
    END IF;

    -- Check if the SELECT policy exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'favorites' 
        AND policyname = 'Users can view their own favorites'
    ) THEN
        CREATE POLICY "Users can view their own favorites"
            ON public.favorites
            FOR SELECT
            TO authenticated
            USING (auth.uid() = user_id);
    END IF;

    -- Check if the DELETE policy exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'favorites' 
        AND policyname = 'Users can delete their own favorites'
    ) THEN
        CREATE POLICY "Users can delete their own favorites"
            ON public.favorites
            FOR DELETE
            TO authenticated
            USING (auth.uid() = user_id);
    END IF;
END $$;