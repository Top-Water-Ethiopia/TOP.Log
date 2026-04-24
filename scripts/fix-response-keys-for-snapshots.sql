-- Fix response keys to match snapshot keys (use question_label as key)
-- This ensures responses populate correctly in the edit form

DO $$
DECLARE
  report_record RECORD;
BEGIN
  -- For each report with a snapshot
  FOR report_record IN 
    SELECT id, questions_snapshot FROM captain_log_entries WHERE questions_snapshot IS NOT NULL
  LOOP
    -- Update all responses for this report to use question_label as question_key
    UPDATE custom_responses
    SET question_key = question_label
    WHERE entry_id = report_record.id;
    
    RAISE NOTICE 'Updated response keys for report %', report_record.id;
  END LOOP;
  
  RAISE NOTICE 'Migration complete';
END $$;

-- Clean up empty responses
DELETE FROM custom_responses
WHERE value IS NULL OR value = 'null'::jsonb;

-- Verify the fix
SELECT 
  e.id,
  e.entry_date,
  COUNT(cr.id) as response_count,
  jsonb_array_length(e.questions_snapshot) as snapshot_question_count
FROM captain_log_entries e
LEFT JOIN custom_responses cr ON cr.entry_id = e.id
WHERE e.questions_snapshot IS NOT NULL
GROUP BY e.id, e.entry_date, e.questions_snapshot
ORDER BY e.entry_date DESC
LIMIT 10;
