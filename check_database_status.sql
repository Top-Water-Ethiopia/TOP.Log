-- Database Status Check
-- Run this in Supabase SQL Editor to diagnose admin reports issues

-- \echo '🔍 DATABASE STATUS CHECK'
-- \echo '====================='
-- \echo ''

-- -- 1. Check auth users
-- \echo '1. AUTH USERS:'
-- \echo '-------------'
SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC LIMIT 5;
-- \echo ''

-- 2. Check user profiles
-- \echo '2. USER PROFILES:'
-- \echo '----------------'
SELECT 
  user_id, 
  name, 
--   email, 
  role_id,
  CASE 
    WHEN role_id = '00000000-0000-0000-0000-000000000000' THEN 'Super Admin'
    WHEN role_id = '00000000-0000-0000-0000-000000000001' THEN 'Admin'
    WHEN role_id = '00000000-0000-0000-0000-000000000002' THEN 'User'
    WHEN role_id = '00000000-0000-0000-0000-000000000003' THEN 'Viewer'
    ELSE 'Unknown Role'
  END as role_name,
  is_active,
  created_at
FROM user_profiles 
ORDER BY created_at DESC;
-- \echo ''

-- 3. Check roles
-- \echo '3. ROLES:'
-- \echo '---------'
SELECT id, name FROM roles;
-- \echo ''

-- 4. Check departments
-- \echo '4. DEPARTMENTS:'
-- \echo '---------------'
SELECT id, name, created_at FROM departments ORDER BY name;
-- \echo ''

-- 5. Check captain log entries
-- \echo '5. CAPTAIN LOG ENTRIES:'
-- \echo '----------------------'
SELECT 
  id,
  user_id,
  date,
  created_at,
  (SELECT COUNT(*) FROM custom_responses WHERE entry_id = captain_log_entries.id) as response_count
FROM captain_log_entries 
ORDER BY created_at DESC 
LIMIT 10;
-- \echo ''

-- 6. Check custom responses
-- \echo '6. CUSTOM RESPONSES:'
-- \echo '-------------------'
SELECT 
  id,
  entry_id,
  question_key,
  question_label,
  LENGTH(value::text) as value_length,
  timestamp
FROM custom_responses 
ORDER BY timestamp DESC 
LIMIT 10;
-- \echo ''

-- 7. Summary counts
-- \echo '7. SUMMARY:'
-- \echo '----------'
SELECT 'auth.users' as table_name, COUNT(*) as count FROM auth.users
UNION ALL
SELECT 'user_profiles' as table_name, COUNT(*) as count FROM user_profiles
UNION ALL
SELECT 'roles' as table_name, COUNT(*) as count FROM roles
UNION ALL
SELECT 'departments' as table_name, COUNT(*) as count FROM departments
UNION ALL
SELECT 'captain_log_entries' as table_name, COUNT(*) as count FROM captain_log_entries
UNION ALL
SELECT 'custom_responses' as table_name, COUNT(*) as count FROM custom_responses
ORDER BY table_name;
-- \echo ''

-- 8. Check for admin users
\echo '8. ADMIN USERS:'
\echo '--------------'
SELECT 
  up.user_id,
  up.name,
  up.email,
  r.name as role_name
FROM user_profiles up
JOIN roles r ON up.role_id = r.id
WHERE r.level >= 4  -- Admin level and above
ORDER BY up.name;
\echo ''

\echo '✅ DATABASE CHECK COMPLETE'
\echo 'If you see this message, the query ran successfully!'