/*
  # Fix transaction handling for Edge Functions
  
  1. Changes
     - Remove transaction functions that aren't compatible with Edge Functions
     - Add a unique constraint to proposals table to ensure idempotency
  
  2. Reason
     - EXECUTE statements aren't supported in Edge Functions
     - We need to ensure idempotent operations without transactions
*/

-- Drop the transaction functions that aren't compatible with Edge Functions
DROP FUNCTION IF EXISTS begin_transaction;
DROP FUNCTION IF EXISTS commit_transaction;
DROP FUNCTION IF EXISTS rollback_transaction;

-- Make sure we have a unique constraint on proposals.request_id for idempotency
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'proposals_request_id_key'
  ) THEN
    -- Add a unique index on request_id to enforce idempotency
    CREATE UNIQUE INDEX proposals_request_id_key ON proposals (request_id) 
    WHERE request_id IS NOT NULL;
  END IF;
END $$;