-- Migration: Enforce one question per role
-- This migration changes the unique constraint to ensure each role can only have one question

-- First, remove the old unique constraint
ALTER TABLE role_questions 
DROP CONSTRAINT IF EXISTS role_questions_role_id_question_key_key;

-- Remove any duplicate questions (keep the first one for each role)
DELETE FROM role_questions rq1
WHERE rq1.id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (PARTITION BY role_id ORDER BY id::text) AS rn
    FROM role_questions
  ) ranked
  WHERE ranked.rn > 1
);

-- Add new unique constraint on role_id only
ALTER TABLE role_questions
ADD CONSTRAINT role_questions_role_id_unique UNIQUE (role_id);

-- Add a comment to document this constraint
COMMENT ON CONSTRAINT role_questions_role_id_unique ON role_questions IS 
'Ensures each role can only have one question. If a role needs multiple questions, they should be combined into a single question with appropriate type (e.g., multiselect).';






