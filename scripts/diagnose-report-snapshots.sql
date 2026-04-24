-- Diagnostic script to check report snapshot status
-- Run this to understand which reports have snapshots and which don't

-- Check total reports and snapshot status
SELECT 
  COUNT(*) as total_reports,
  COUNT(CASE WHEN questions_snapshot IS NOT NULL THEN 1 END) as has_snapshot,
  COUNT(CASE WHEN questions_snapshot IS NULL THEN 1 END) as no_snapshot,
  COUNT(CASE WHEN is_editable_applied = true THEN 1 END) as is_editable,
  COUNT(CASE WHEN is_editable_applied = true AND questions_snapshot IS NULL THEN 1 END) as editable_but_no_snapshot
FROM captain_log_entries;

-- Show recent reports with their snapshot status
SELECT 
  id,
  entry_date,
  is_editable_applied,
  questions_snapshot IS NOT NULL as has_snapshot,
  questions_snapshot_version,
  questions_snapshot_hash,
  created_at
FROM captain_log_entries
ORDER BY created_at DESC
LIMIT 10;

-- Show reports that are marked as editable but have no snapshot (problematic)
SELECT 
  id,
  entry_date,
  submitted_by_user_id,
  is_editable_applied,
  questions_snapshot IS NOT NULL as has_snapshot,
  created_at
FROM captain_log_entries
WHERE is_editable_applied = true 
  AND questions_snapshot IS NULL
LIMIT 10;

-- Check if there are any role_questions with conditional_logic (for Phase 5 testing)
SELECT 
  COUNT(*) as total_questions,
  COUNT(CASE WHEN conditional_logic IS NOT NULL THEN 1 END) as has_conditional_logic
FROM role_questions;
