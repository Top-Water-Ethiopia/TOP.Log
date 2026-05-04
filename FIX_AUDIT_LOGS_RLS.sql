-- ============================================================================
-- URGENT FIX: Enable Users to Create Audit Logs & View Custom Responses
-- ============================================================================
-- INSTRUCTIONS:
-- 1. Go to your Supabase Dashboard
-- 2. Navigate to SQL Editor
-- 3. Copy and paste this entire script
-- 4. Click "Run" to execute
-- ============================================================================

-- Fix audit_logs RLS Policies
-- This adds INSERT policy for audit_logs table so users can create
-- audit log entries when they perform actions on their own data

BEGIN;

-- ============================================================================
-- Part 1: Fix audit_logs table policies
-- ============================================================================

-- Ensure RLS is enabled on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can insert their own audit logs" ON public.audit_logs;

-- Policy: Users can view their own audit logs
CREATE POLICY "Users can view their own audit logs"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own audit logs
-- This allows users to create audit logs for their own actions
CREATE POLICY "Users can insert their own audit logs"
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- Part 2: Ensure custom_responses policies are correct
-- ============================================================================

-- Ensure RLS is enabled on custom_responses
ALTER TABLE public.custom_responses ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies to ensure they're correct
DROP POLICY IF EXISTS "Users can view their own responses" ON public.custom_responses;
DROP POLICY IF EXISTS "Users can insert their own responses" ON public.custom_responses;
DROP POLICY IF EXISTS "Users can update their own responses" ON public.custom_responses;

-- Policy: Users can view responses for their own entries
CREATE POLICY "Users can view their own responses"
  ON public.custom_responses
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.captain_log_entries
    WHERE captain_log_entries.id = custom_responses.entry_id
    AND captain_log_entries.user_id = auth.uid()
  ));

-- Policy: Users can insert responses for their own entries
CREATE POLICY "Users can insert their own responses"
  ON public.custom_responses
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.captain_log_entries
    WHERE captain_log_entries.id = custom_responses.entry_id
    AND captain_log_entries.user_id = auth.uid()
  ));

-- Policy: Users can update responses for their own entries
CREATE POLICY "Users can update their own responses"
  ON public.custom_responses
  FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.captain_log_entries
    WHERE captain_log_entries.id = custom_responses.entry_id
    AND captain_log_entries.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.captain_log_entries
    WHERE captain_log_entries.id = custom_responses.entry_id
    AND captain_log_entries.user_id = auth.uid()
  ));

COMMIT;

-- ============================================================================
-- VERIFICATION - Check that policies were created successfully
-- ============================================================================

SELECT 
  '✅ RLS Policies for audit_logs' as status,
  policyname,
  cmd,
  CASE 
    WHEN cmd = 'SELECT' THEN 'Read own audit logs'
    WHEN cmd = 'INSERT' THEN 'Create own audit logs'
    ELSE cmd
  END as description
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'audit_logs'
ORDER BY cmd, policyname;

-- Show if RLS is enabled
SELECT 
  tablename,
  CASE 
    WHEN rowsecurity THEN '✅ RLS Enabled'
    ELSE '❌ RLS Disabled'
  END as rls_status
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'audit_logs';
