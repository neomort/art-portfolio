/*
  # Add transaction helper functions

  1. New Functions
    - `begin_transaction` - Begins a transaction
    - `commit_transaction` - Commits a transaction
    - `rollback_transaction` - Rolls back a transaction

  2. Purpose
    - These functions allow edge functions to use transactions for atomic operations
*/

-- Create function to begin a transaction
CREATE OR REPLACE FUNCTION begin_transaction()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE 'BEGIN';
END;
$$ SET search_path = pg_catalog, public;

-- Create function to commit a transaction
CREATE OR REPLACE FUNCTION commit_transaction()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE 'COMMIT';
END;
$$ SET search_path = pg_catalog, public;

-- Create function to rollback a transaction
CREATE OR REPLACE FUNCTION rollback_transaction()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE 'ROLLBACK';
END;
$$ SET search_path = pg_catalog, public;

-- Add comments to explain the purpose of these functions
COMMENT ON FUNCTION begin_transaction() IS 'Begins a transaction for use in edge functions';
COMMENT ON FUNCTION commit_transaction() IS 'Commits a transaction for use in edge functions';
COMMENT ON FUNCTION rollback_transaction() IS 'Rolls back a transaction for use in edge functions';