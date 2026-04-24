-- Add unique constraint on (entry_id, idempotency_key) if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'entry_edits_entry_id_idempotency_key_key'
  ) THEN
    ALTER TABLE entry_edits
    ADD CONSTRAINT entry_edits_entry_id_idempotency_key_key
    UNIQUE (entry_id, idempotency_key);
  END IF;
END $$;

-- Create function for atomic insert with idempotency
CREATE OR REPLACE FUNCTION insert_entry_edit_with_idempotency(
  p_entry_id UUID,
  p_edited_by UUID,
  p_edit_type TEXT,
  p_previous_responses JSONB,
  p_new_responses JSONB,
  p_idempotency_key TEXT DEFAULT NULL
) RETURNS TABLE (id UUID, inserted BOOLEAN) LANGUAGE plpgsql AS $$
DECLARE
  inserted_id UUID;
BEGIN
  INSERT INTO entry_edits (
    entry_id, edited_by, edit_type, previous_custom_responses,
    new_custom_responses, idempotency_key
  ) VALUES (
    p_entry_id, p_edited_by, p_edit_type, p_previous_responses,
    p_new_responses, p_idempotency_key
  )
  ON CONFLICT (entry_id, idempotency_key) DO NOTHING
  RETURNING id INTO inserted_id;
  
  RETURN QUERY SELECT inserted_id, inserted_id IS NOT NULL;
END;
$$;
