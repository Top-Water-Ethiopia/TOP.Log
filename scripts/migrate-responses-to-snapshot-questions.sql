-- Migration script to add responses for snapshot questions
-- This creates custom_responses entries for the new snapshot questions
-- It tries to preserve old responses if they exist, otherwise creates empty responses

DO $$
DECLARE
  report_record RECORD;
  question_record RECORD;
  existing_value jsonb;
  snapshot_json jsonb;
BEGIN
  -- For each report with a snapshot
  FOR report_record IN 
    SELECT id, questions_snapshot FROM captain_log_entries WHERE questions_snapshot IS NOT NULL
  LOOP
    snapshot_json := report_record.questions_snapshot;
    
    -- For each question in the snapshot
    FOR question_record IN 
      SELECT * FROM jsonb_array_elements(snapshot_json)
    LOOP
      -- Check if there's already a response for this question
      SELECT value INTO existing_value
      FROM custom_responses
      WHERE entry_id = report_record.id
        AND question_id = (question_record.value->>'id');
      
      -- If no response exists, create one (empty or try to find old response)
      IF existing_value IS NULL THEN
        -- Try to find an old response by matching question label
        -- This is a best-effort approach since the old schema may not match
        INSERT INTO custom_responses (entry_id, question_id, question_key, question_label, question_type, value)
        SELECT 
          report_record.id,
          question_record.value->>'id',
          question_record.value->>'key',
          question_record.value->>'label',
          question_record.value->>'type',
          COALESCE(
            (SELECT value FROM custom_responses 
             WHERE entry_id = report_record.id 
               AND question_label = question_record.value->>'label' 
             LIMIT 1),
            NULL
          )
        ON CONFLICT DO NOTHING;
        
        RAISE NOTICE 'Created response for report % question %', report_record.id, question_record.value->>'label';
      END IF;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Migration complete';
END $$;

-- Verify the migration
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
