-- ============================================================================
-- DATABASE SCHEMA CLEANUP SCRIPT
-- ============================================================================
-- This script removes redundant and unused tables from your database.
-- 
-- TABLES TO BE REMOVED:
-- 1. reports (duplicate of captain_log_entries)
-- 2. report_answers (duplicate of custom_responses)
-- 3. report_questions (duplicate of role_questions)
-- 4. department_questions (unused)
-- 5. admins (redundant - using roles.level instead)
--
-- WARNING: This will permanently delete these tables and their data!
-- Make sure to backup first!
-- ============================================================================

-- ============================================================================
-- STEP 1: CHECK FOR DATA (DO NOT SKIP!)
-- ============================================================================

\echo '🔍 CHECKING FOR DATA IN TABLES TO BE REMOVED'
\echo '============================================='
\echo ''

-- Check reports table
\echo '1. reports table:'
SELECT 
  'reports' as table_name, 
  COUNT(*) as row_count,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ Empty - safe to remove'
    ELSE '⚠️  HAS DATA - need to migrate first!'
  END as status
FROM reports;
\echo ''

-- Check report_answers table
\echo '2. report_answers table:'
SELECT 
  'report_answers' as table_name,
  COUNT(*) as row_count,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ Empty - safe to remove'
    ELSE '⚠️  HAS DATA - need to migrate first!'
  END as status
FROM report_answers;
\echo ''

-- Check report_questions table
\echo '3. report_questions table:'
SELECT 
  'report_questions' as table_name,
  COUNT(*) as row_count,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ Empty - safe to remove'
    ELSE '⚠️  HAS DATA - check if needed'
  END as status
FROM report_questions;
\echo ''

-- Check department_questions table
\echo '4. department_questions table:'
SELECT 
  'department_questions' as table_name,
  COUNT(*) as row_count,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ Empty - safe to remove'
    ELSE '⚠️  HAS DATA - check if needed'
  END as status
FROM department_questions;
\echo ''

-- Check admins table
\echo '5. admins table:'
SELECT 
  'admins' as table_name,
  COUNT(*) as row_count,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ Empty - safe to remove'
    ELSE '⚠️  HAS DATA - migrate to user_profiles.role_id'
  END as status
FROM admins;
\echo ''

-- ============================================================================
-- STEP 2: BACKUP (OPTIONAL - RECOMMENDED)
-- ============================================================================

-- Uncomment to create backups:
-- CREATE TABLE reports_backup AS SELECT * FROM reports;
-- CREATE TABLE report_answers_backup AS SELECT * FROM report_answers;
-- CREATE TABLE report_questions_backup AS SELECT * FROM report_questions;
-- CREATE TABLE department_questions_backup AS SELECT * FROM department_questions;
-- CREATE TABLE admins_backup AS SELECT * FROM admins;

-- ============================================================================
-- STEP 3: SAMPLE DATA FROM TABLES TO BE REMOVED
-- ============================================================================

\echo '📋 SAMPLE DATA FROM TABLES TO BE REMOVED'
\echo '========================================'
\echo ''

\echo 'Sample from reports (first 5 rows):'
SELECT * FROM reports LIMIT 5;
\echo ''

\echo 'Sample from report_answers (first 5 rows):'
SELECT * FROM report_answers LIMIT 5;
\echo ''

\echo 'Sample from report_questions (first 5 rows):'
SELECT * FROM report_questions LIMIT 5;
\echo ''

\echo 'Sample from department_questions (first 5 rows):'
SELECT * FROM department_questions LIMIT 5;
\echo ''

\echo 'Sample from admins (all rows):'
SELECT * FROM admins;
\echo ''

-- ============================================================================
-- STEP 4: MIGRATION (If tables have data)
-- ============================================================================

-- If you have data in reports/report_answers, uncomment and adapt this migration:
/*
BEGIN;

-- Migrate reports to captain_log_entries
INSERT INTO captain_log_entries (id, user_id, date, created_at, updated_at, metadata)
SELECT 
  id,
  user_id,
  DATE(submitted_at) as date,
  created_at,
  created_at as updated_at,
  '{}'::jsonb as metadata
FROM reports
WHERE id NOT IN (SELECT id FROM captain_log_entries)
ON CONFLICT (user_id, date) DO NOTHING;

-- Migrate report_answers to custom_responses
INSERT INTO custom_responses (entry_id, question_id, question_key, question_label, question_type, value, timestamp)
SELECT 
  ra.report_id as entry_id,
  rq.id as question_id,
  rq.question_key,
  rq.question_label,
  rq.question_type,
  to_jsonb(ra.answer) as value,
  ra.created_at as timestamp
FROM report_answers ra
JOIN report_questions rq ON ra.question_id = rq.id
ON CONFLICT DO NOTHING;

COMMIT;
*/

-- ============================================================================
-- STEP 5: DROP TABLES (DANGER ZONE!)
-- ============================================================================

-- UNCOMMENT BELOW TO ACTUALLY DROP TABLES
-- WARNING: THIS IS PERMANENT!
-- Only run after verifying data is empty or migrated!

/*
BEGIN;

\echo '🗑️  DROPPING REDUNDANT AND UNUSED TABLES'
\echo '======================================='
\echo ''

-- Drop in correct order (respect foreign keys)
\echo 'Dropping report_answers...'
DROP TABLE IF EXISTS report_answers CASCADE;

\echo 'Dropping report_questions...'
DROP TABLE IF EXISTS report_questions CASCADE;

\echo 'Dropping reports...'
DROP TABLE IF EXISTS reports CASCADE;

\echo 'Dropping department_questions...'
DROP TABLE IF EXISTS department_questions CASCADE;

\echo 'Dropping admins...'
DROP TABLE IF EXISTS admins CASCADE;

COMMIT;

\echo ''
\echo '✅ CLEANUP COMPLETE!'
\echo ''
*/

-- ============================================================================
-- STEP 6: VERIFY CLEANUP
-- ============================================================================

\echo '🔍 VERIFY REMAINING TABLES'
\echo '=========================='
\echo ''

SELECT 
  table_name,
  CASE 
    WHEN table_name IN ('user_profiles', 'roles', 'departments', 'captain_log_entries', 'custom_responses', 'role_questions', 'permissions', 'audit_logs')
    THEN '✅ CORE TABLE'
    ELSE '⚠️  Check if needed'
  END as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- ============================================================================
-- STEP 7: VERIFY DATA INTEGRITY
-- ============================================================================

\echo ''
\echo '🔍 VERIFY DATA INTEGRITY'
\echo '======================='
\echo ''

-- Check row counts
SELECT 'auth.users' as table_name, COUNT(*) as count FROM auth.users
UNION ALL
SELECT 'user_profiles', COUNT(*) FROM user_profiles
UNION ALL
SELECT 'roles', COUNT(*) FROM roles
UNION ALL
SELECT 'departments', COUNT(*) FROM departments
UNION ALL
SELECT 'captain_log_entries', COUNT(*) FROM captain_log_entries
UNION ALL
SELECT 'custom_responses', COUNT(*) FROM custom_responses
UNION ALL
SELECT 'role_questions', COUNT(*) FROM role_questions
UNION ALL
SELECT 'permissions', COUNT(*) FROM permissions
UNION ALL
SELECT 'audit_logs', COUNT(*) FROM audit_logs
ORDER BY table_name;

-- ============================================================================
-- FINAL NOTES
-- ============================================================================

\echo ''
\echo '📝 CLEANUP SUMMARY'
\echo '=================='
\echo ''
\echo 'Tables marked for removal:'
\echo '  ❌ reports (duplicate of captain_log_entries)'
\echo '  ❌ report_answers (duplicate of custom_responses)'
\echo '  ❌ report_questions (duplicate of role_questions)'
\echo '  ❌ department_questions (unused)'
\echo '  ❌ admins (redundant - using roles.level)'
\echo ''
\echo 'Tables to keep:'
\echo '  ✅ user_profiles (core)'
\echo '  ✅ roles (core)'
\echo '  ✅ departments (core)'
\echo '  ✅ captain_log_entries (main system)'
\echo '  ✅ custom_responses (main system)'
\echo '  ✅ role_questions (main system)'
\echo '  ✅ permissions (future features)'
\echo '  ✅ audit_logs (compliance)'
\echo ''
\echo 'Next steps:'
\echo '  1. Review the data check results above'
\echo '  2. If all tables are empty, uncomment STEP 5 and run again'
\echo '  3. If tables have data, uncomment STEP 4 migration first'
\echo '  4. Update code to remove references to deleted tables'
\echo '  5. Test thoroughly!'
\echo ''
\echo '✅ ANALYSIS COMPLETE'
