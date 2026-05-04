-- Verify that RLS policies for role_questions were created correctly
-- Run this after applying QUICK_FIX_ROLE_QUESTIONS_RLS.sql

-- Check if policies exist
SELECT 
  schemaname,
  tablename,
  policyname, 
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'role_questions' 
ORDER BY policyname;

-- Check if RLS is enabled on the table
SELECT 
  schemaname,
  tablename,
  rowsecurity as "RLS Enabled"
FROM pg_tables 
WHERE tablename = 'role_questions';

-- Test query: Try to select from role_questions as current user
-- This will show if you have access
SELECT 
  COUNT(*) as "Total Questions",
  COUNT(*) FILTER (WHERE is_active = true) as "Active Questions",
  COUNT(*) FILTER (WHERE is_active = false) as "Inactive Questions"
FROM role_questions;

-- If the above query works, try to see the actual questions
SELECT 
  id,
  role_id,
  question_key,
  question_label,
  question_type,
  is_active,
  created_at
FROM role_questions
ORDER BY created_at DESC
LIMIT 10;

