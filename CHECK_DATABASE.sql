-- Check what data exists in the database

-- 1. Check captain_log_entries
SELECT 
  'captain_log_entries' as table_name,
  COUNT(*) as count
FROM captain_log_entries;

-- 2. Check custom_responses
SELECT 
  'custom_responses' as table_name,
  COUNT(*) as count
FROM custom_responses;

-- 3. Check user_profiles
SELECT 
  'user_profiles' as table_name,
  COUNT(*) as count
FROM user_profiles;

-- 4. Check roles
SELECT 
  'roles' as table_name,
  COUNT(*) as count
FROM roles;

-- 5. Check departments
SELECT 
  'departments' as table_name,
  COUNT(*) as count
FROM departments;

-- 6. Sample entry with custom responses
SELECT 
  e.id as entry_id,
  e.date,
  e.user_id,
  up.name as user_name,
  up.email,
  r.name as role_name,
  d.name as department_name,
  (
    SELECT COUNT(*)
    FROM custom_responses cr
    WHERE cr.entry_id = e.id
  ) as custom_response_count
FROM captain_log_entries e
LEFT JOIN user_profiles up ON e.user_id = up.user_id
LEFT JOIN roles r ON up.role_id = r.id
LEFT JOIN departments d ON up.department_id = d.id
ORDER BY e.created_at DESC
LIMIT 5;

-- 7. Custom responses for the first entry
SELECT 
  cr.entry_id,
  cr.question_key,
  cr.question_label,
  cr.value
FROM custom_responses cr
WHERE cr.entry_id IN (
  SELECT id FROM captain_log_entries ORDER BY created_at DESC LIMIT 1
);
