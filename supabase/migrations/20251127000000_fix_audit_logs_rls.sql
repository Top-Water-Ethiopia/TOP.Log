-- ============================================================================
-- Fix audit_logs RLS Policies
-- ============================================================================
-- This migration adds INSERT policy for audit_logs table so users can create
-- audit log entries when they perform actions on their own data
-- ============================================================================

BEGIN;

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

COMMIT;

-- Verify the policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual as using_expression,
  with_check as check_expression
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'audit_logs'
ORDER BY cmd, policyname;
