-- Migration: Remove One Question Per Role Constraint
-- This migration removes the unique constraint on role_id to allow multiple questions per role
-- and restores a composite unique constraint on (role_id, question_key) to prevent duplicate keys

-- Drop the existing unique constraint on role_id
ALTER TABLE role_questions 
DROP CONSTRAINT IF EXISTS role_questions_role_id_unique;

-- Add composite unique constraint on (role_id, question_key)
-- This ensures each question key is unique within a role, but allows multiple questions per role
ALTER TABLE role_questions
ADD CONSTRAINT role_questions_role_id_question_key_unique UNIQUE (role_id, question_key);

-- Update display_order to be meaningful for multiple questions
-- Set display_order based on created_at for existing questions
ALTER TABLE role_questions
  ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'role_questions'
      AND column_name = 'created_at'
  ) THEN
    EXECUTE $sql$
      UPDATE role_questions
      SET display_order = subquery.row_number - 1
      FROM (
        SELECT
          id,
          ROW_NUMBER() OVER (PARTITION BY role_id ORDER BY created_at) as row_number
        FROM role_questions
      ) AS subquery
      WHERE role_questions.id = subquery.id;
    $sql$;
  ELSE
    EXECUTE $sql$
      UPDATE role_questions
      SET display_order = subquery.row_number - 1
      FROM (
        SELECT
          id,
          ROW_NUMBER() OVER (PARTITION BY role_id ORDER BY id::text) as row_number
        FROM role_questions
      ) AS subquery
      WHERE role_questions.id = subquery.id;
    $sql$;
  END IF;
END;
$$;

-- Add comment to document the change
COMMENT ON CONSTRAINT role_questions_role_id_question_key_unique ON role_questions IS 
'Ensures each question key is unique within a role. Multiple questions per role are now allowed.';





