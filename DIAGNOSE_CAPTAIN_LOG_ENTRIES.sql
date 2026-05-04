-- Diagnostic script for captain_log_entries RLS and data issues
-- Run this in Supabase SQL Editor to diagnose why queries return empty arrays

BEGIN;

-- 1. Check if table exists and has RLS enabled
SELECT 
  'Table exists' as check_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'captain_log_entries'
  ) THEN '✅ YES' ELSE '❌ NO' END as result;

SELECT 
  'RLS enabled' as check_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE t.schemaname = 'public' 
    AND t.tablename = 'captain_log_entries'
    AND c.relrowsecurity = true
  ) THEN '✅ YES' ELSE '❌ NO' END as result;

-- 2. List all RLS policies on captain_log_entries
SELECT 
  'RLS Policies' as check_name,
  policyname as policy_name,
  cmd as command,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'captain_log_entries'
ORDER BY policyname;

-- 3. Check total row count (as service_role, bypasses RLS)
-- Note: This requires service_role key or running as postgres
SELECT 
  'Total entries count' as check_name,
  COUNT(*)::text as result
FROM captain_log_entries;

-- 4. Check entries for specific user (ccb4613c-3e6d-4421-8b1c-3277280d658c)
SELECT 
  'Entries for user ccb4613c-3e6d-4421-8b1c-3277280d658c' as check_name,
  COUNT(*)::text as result
FROM captain_log_entries
WHERE user_id = 'ccb4613c-3e6d-4421-8b1c-3277280d658c'::UUID;

-- 5. Check if user exists in auth.users
SELECT 
  'User exists in auth.users' as check_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = 'ccb4613c-3e6d-4421-8b1c-3277280d658c'::UUID
  ) THEN '✅ YES' ELSE '❌ NO' END as result;

-- 6. Check if user has a profile
SELECT 
  'User has profile' as check_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_id = 'ccb4613c-3e6d-4421-8b1c-3277280d658c'::UUID
  ) THEN '✅ YES' ELSE '❌ NO' END as result;

-- 7. Check user's role (if profile exists)
SELECT 
  'User role' as check_name,
  COALESCE(r.name, 'NO PROFILE') as result
FROM user_profiles up
LEFT JOIN roles r ON r.id = up.role_id
WHERE up.user_id = 'ccb4613c-3e6d-4421-8b1c-3277280d658c'::UUID;

-- 8. Test RLS policy evaluation (simulate what happens during query)
-- This shows what auth.uid() would return (will be NULL in SQL editor, but shows the logic)
SELECT 
  'RLS Policy Test' as check_name,
  CASE 
    WHEN auth.uid() IS NULL THEN '⚠️  auth.uid() is NULL (expected in SQL editor)'
    WHEN auth.uid() = 'ccb4613c-3e6d-4421-8b1c-3277280d658c'::UUID THEN '✅ auth.uid() matches user_id'
    ELSE '❌ auth.uid() does not match user_id'
  END as result;

-- 9. Show sample entries (if any exist, bypassing RLS for diagnostic purposes)
SELECT 
  'Sample entries (first 5)' as check_name,
  id::text as entry_id,
  user_id::text,
  date::text,
  created_at::text
FROM captain_log_entries
ORDER BY created_at DESC
LIMIT 5;

COMMIT;

-- Instructions:
-- 1. If "Total entries count" is 0, there's no data in the table
-- 2. If "Entries for user" is 0 but "Total entries count" > 0, RLS might be blocking
-- 3. If policies don't include admin access, admins can't see all entries
-- 4. If auth.uid() is NULL in SQL editor, that's expected - RLS uses the JWT token in API calls

