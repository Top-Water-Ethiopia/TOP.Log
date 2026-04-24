-- Migration script to add snapshots to all legacy reports
-- This adds questions_snapshot, questions_snapshot_hash, and questions_snapshot_version
-- to all reports that are marked as editable but have no snapshot

-- First, let's get the current active role_questions to build the snapshot
DO $$
DECLARE
  snapshot_json jsonb;
  snapshot_hash text;
  report_record RECORD;
BEGIN
  -- Build the snapshot from active role_questions
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', rq.id,
      'key', rq.question_label,
      'label', rq.question_label,
      'type', rq.question_type,
      'required', rq.is_required,
      'display_order', rq.display_order,
      'options', rq.options,
      'validation_rules', rq.validation_rules
    )
  ) INTO snapshot_json
  FROM (
    SELECT * FROM role_questions 
    WHERE is_active = true 
    ORDER BY display_order
  ) rq;

  -- Compute a simple hash (you may want to use a proper hash function in production)
  snapshot_hash := encode(digest(snapshot_json::text, 'sha256'), 'hex');

  -- Update all legacy reports (marked as editable but no snapshot)
  FOR report_record IN 
    SELECT id FROM captain_log_entries 
    WHERE is_editable_applied = true AND questions_snapshot IS NULL
  LOOP
    UPDATE captain_log_entries
    SET 
      questions_snapshot = snapshot_json,
      questions_snapshot_hash = snapshot_hash,
      questions_snapshot_version = 1,
      updated_at = NOW()
    WHERE id = report_record.id;
    
    RAISE NOTICE 'Updated report % with snapshot', report_record.id;
  END LOOP;

  RAISE NOTICE 'Migration complete. Updated % reports.', (SELECT COUNT(*) FROM captain_log_entries WHERE is_editable_applied = true AND questions_snapshot IS NULL);
END $$;

-- Verify the migration
SELECT 
  COUNT(*) as total_reports,
  COUNT(CASE WHEN questions_snapshot IS NOT NULL THEN 1 END) as has_snapshot,
  COUNT(CASE WHEN is_editable_applied = true AND questions_snapshot IS NULL THEN 1 END) as still_missing
FROM captain_log_entries;

-- Show a sample of updated reports
SELECT 
  id,
  entry_date,
  is_editable_applied,
  questions_snapshot IS NOT NULL as has_snapshot,
  questions_snapshot_version,
  jsonb_array_length(questions_snapshot) as question_count
FROM captain_log_entries
WHERE questions_snapshot IS NOT NULL
LIMIT 5;
