-- Debug script to check actual RLS status and policies on properties table
-- Run this against your remote database to see what's actually configured

-- Check if RLS is enabled on properties table
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    hasrls as has_rls_policies
FROM pg_tables 
WHERE tablename = 'properties' AND schemaname = 'public';

-- List all policies on properties table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'properties' AND schemaname = 'public';

-- Check if there are any triggers on properties table that might enforce RLS-like behavior
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'properties' AND event_object_schema = 'public';

-- Check table owner and permissions
SELECT 
    table_schema,
    table_name,
    table_type,
    is_insertable_into
FROM information_schema.tables 
WHERE table_name = 'properties' AND table_schema = 'public';
