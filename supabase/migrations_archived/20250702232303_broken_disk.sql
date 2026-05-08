/*
  # Add is_admin column to profiles table

  1. Schema Changes
    - Add `is_admin` boolean column to `profiles` table with default value of false
*/

ALTER TABLE public.profiles
ADD COLUMN is_admin boolean DEFAULT false;