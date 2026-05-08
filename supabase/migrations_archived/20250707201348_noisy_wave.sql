/*
  # Add request_id to proposals table

  1. New Columns
    - `request_id` (text, nullable) - Unique identifier for the request to create a proposal, used for idempotency

  2. Changes
    - Adds a new column to the proposals table to support idempotent operations
*/

-- Add request_id column to proposals table
ALTER TABLE proposals 
ADD COLUMN IF NOT EXISTS request_id text;

-- Add a unique index on request_id to enforce idempotency
CREATE UNIQUE INDEX IF NOT EXISTS proposals_request_id_key ON proposals (request_id) 
WHERE request_id IS NOT NULL;

-- Add a comment explaining the purpose of the column
COMMENT ON COLUMN proposals.request_id IS 'Unique identifier for the request to create a proposal, used for idempotency';