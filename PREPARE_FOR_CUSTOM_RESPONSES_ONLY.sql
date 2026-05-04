-- ============================================================================
-- PREPARATION: Prepare Captain Log for Custom Responses Only Migration
-- ============================================================================
-- This script prepares the database for migrating to custom responses only by:
-- 1. Dropping existing RLS policies that reference the predefined columns
-- 2. Temporarily disabling RLS to allow schema changes
-- 3. Preparing for the migration to custom responses only
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Drop existing RLS policies that reference predefined columns
-- ============================================================================

-- First, check what policies exist
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual as using_expression,
  with_check as check_expression
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('captain_log_entries', 'custom_responses')
ORDER BY tablename, cmd, policyname;

-- ============================================================================
-- STEP 2: Temporarily disable RLS to allow schema changes
-- ============================================================================

-- Disable RLS temporarily for captain_log_entries
ALTER TABLE public.captain_log_entries DISABLE ROW LEVEL SECURITY;

-- Disable RLS temporarily for custom_responses  
ALTER TABLE public.custom_responses DISABLE ROW LEVEL SECURITY;

-- Disable RLS temporarily for audit_logs
ALTER TABLE public.audit_logs DISABLE ROW LEVEL SECURITY;

COMMIT;

-- ============================================================================
-- VERIFICATION: Check that RLS is disabled
-- ============================================================================

SELECT 
  tablename,
  CASE 
    WHEN rowsecurity THEN '✅ RLS Enabled'
    ELSE '❌ RLS Disabled'
  END as rls_status
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename IN ('captain_log_entries', 'custom_responses', 'audit_logs');

-- ============================================================================
-- NEXT STEPS:
-- 1. Run MIGRATE_TO_CUSTOM_RESPONSES_ONLY.sql to migrate the data
-- 2. Run FIX_AUDIT_LOGS_RLS.sql to re-enable and fix RLS policies
-- ============================================================================
