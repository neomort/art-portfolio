/*
  # Fix transaction functions and ensure idempotency

  1. Changes
    - Drop transaction functions that aren't compatible with Edge Functions
    - Ensure unique constraint exists on proposals.request_id for idempotency
*/

-- Drop the transaction functions that aren't compatible with Edge Functions
DROP FUNCTION IF EXISTS begin_transaction;
DROP FUNCTION IF EXISTS commit_transaction;
DROP FUNCTION IF EXISTS rollback_transaction;

-- Check if the unique index already exists before creating it
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'proposals_request_id_key'
  ) THEN
    -- Add a unique index on request_id to enforce idempotency
    EXECUTE 'CREATE UNIQUE INDEX proposals_request_id_key ON proposals (request_id) 
    WHERE request_id IS NOT NULL';
  END IF;
END $$;