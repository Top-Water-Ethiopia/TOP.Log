-- Verify RLS policies and test access to role_questions
-- Run this to check if policies were created and if you can access data

-- 1. Check if policies exist (try both schemas)
SELECT 
  schemaname,
  tablename,
  policyname, 
  cmd
FROM pg_policies 
WHERE tablename = 'role_questions' 
ORDER BY policyname;

-- If no results, try without schema filter
SELECT 
  policyname, 
  cmd
FROM pg_policies 
WHERE tablename = 'role_questions';

-- 2. Check if RLS is enabled
SELECT 
  tablename,
  rowsecurity as "RLS Enabled"
FROM pg_tables 
WHERE tablename = 'role_questions';

-- 3. Check your current user and role
SELECT 
  auth.uid() as "Current User ID",
  up.role_id,
  r.name as "Role Name",
  up.is_active as "Profile Active"
FROM user_profiles up
LEFT JOIN roles r ON r.id = up.role_id
WHERE up.user_id = auth.uid();

-- 4. Test if you can query role_questions (this will show if RLS allows access)
SELECT 
  COUNT(*) as "Total Questions You Can See"
FROM role_questions;

-- 5. If the above works, show actual questions
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

