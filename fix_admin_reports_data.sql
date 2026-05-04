-- Fix Admin Reports Data Issues
-- Run this in Supabase SQL Editor to resolve user dropdown problems

\echo '🔧 FIXING ADMIN REPORTS DATA ISSUES'
\echo '==================================='
\echo ''

-- 1. Check which users have entries but no profiles
\echo '1. USERS WITH ENTRIES BUT NO PROFILES:'
\echo '-------------------------------------'
SELECT 
  ce.user_id,
  au.email,
  'Missing profile - entry exists' as issue
FROM captain_log_entries ce
LEFT JOIN user_profiles up ON ce.user_id = up.user_id
LEFT JOIN auth.users au ON ce.user_id = au.id
WHERE up.user_id IS NULL;
\echo ''

-- 2. Check which users have custom responses but no profiles
\echo '2. USERS WITH CUSTOM RESPONSES BUT NO PROFILES:'
\echo '----------------------------------------------'
SELECT DISTINCT
  ce.user_id,
  au.email,
  'Missing profile - custom responses exist' as issue
FROM custom_responses cr
JOIN captain_log_entries ce ON cr.entry_id = ce.id
LEFT JOIN user_profiles up ON ce.user_id = up.user_id
LEFT JOIN auth.users au ON ce.user_id = au.id
WHERE up.user_id IS NULL;
\echo ''

-- 3. Create missing user profiles for users with entries
\echo '3. CREATING MISSING USER PROFILES:'
\echo '---------------------------------'
INSERT INTO user_profiles (user_id, name, email, role_id, department_id, is_active, created_at, updated_at)
SELECT 
  au.id as user_id,
  COALESCE(au.raw_user_meta_data->>'full_name', au.email, 'Unknown User') as name,
  au.email,
  '00000000-0000-0000-0000-000000000002'::UUID as role_id, -- Default to 'user' role
  NULL as department_id,
  true as is_active,
  NOW() as created_at,
  NOW() as updated_at
FROM auth.users au
JOIN captain_log_entries ce ON au.id = ce.user_id
LEFT JOIN user_profiles up ON au.id = up.user_id
WHERE up.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

\echo '✅ Created missing user profiles for users with entries'
\echo ''

-- 4. Update the entry creator to have proper admin access (if needed)
\echo '4. ENSURING ENTRY CREATOR HAS PROFILE:'
\echo '-------------------------------------'
-- Get the user who created the entry
SELECT 
  ce.user_id,
  au.email,
  up.name as profile_name,
  r.name as role_name
                                                         

-- 5. Check all active user profiles with their roles                                                                                                                
\echo '5. ACTIVE USER PROFILES WITH ROLES:'
\echo '----------------------------------'
SELECT 
  up.user_id,
  up.name,
  up.email,
  r.name as role_name,
  up.is_active
FROM user_profiles up
JOIN roles r ON up.role_id = r.id
WHERE up.is_active = true
ORDER BY r.level DESC, up.name;
\echo ''

-- 6. Verify the data structure for the API
\echo '6. VERIFYING DATA STRUCTURE:'
\echo '---------------------------'
-- Check if we have the data needed for admin reports
SELECT 
  'Entries' as data_type,
  COUNT(*) as count,
  'Should be >= 1' as requirement
FROM captain_log_entries
UNION ALL
SELECT 
  'Active Users' as data_type,
  COUNT(*) as count,
  'Should be >= 1' as requirement
FROM user_profiles 
WHERE is_active = true
UNION ALL
SELECT 
  'Roles' as data_type,
  COUNT(*) as count,
  'Should be >= 1' as requirement
FROM roles
UNION ALL
SELECT 
  'Departments' as data_type,
  COUNT(*) as count,
  'Should be >= 1' as requirement
FROM departments
UNION ALL
SELECT 
  'Custom Responses' as data_type,
  COUNT(*) as count,
  'Should be >= 1' as requirement
FROM custom_responses
ORDER BY data_type;
\echo ''

\echo '✅ DATA FIX SCRIPT COMPLETE'
\echo ''
\echo 'Next steps:'
\echo '1. Refresh your admin reports page'
\echo '2. The user dropdown should now show users'
\echo '3. If still not working, check browser console for errors'