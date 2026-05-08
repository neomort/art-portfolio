/*
  # Add fee description field to properties table

  1. Changes
     - Add `fee_description` column to the `properties` table
     - This field allows property owners to provide context for fees
*/

-- Add fee description column to properties table
ALTER TABLE IF EXISTS properties 
ADD COLUMN IF NOT EXISTS fee_description text;