-- Migration: Enhance Questions with Advanced Features
-- Adds support for advanced question types, conditional logic, and validation

-- Update role_questions table to support advanced features
ALTER TABLE role_questions 
  ADD COLUMN IF NOT EXISTS conditional_logic JSONB DEFAULT NULL, -- {"show_if": {"question_id": "...", "operator": "equals", "value": "..."}}
  ADD COLUMN IF NOT EXISTS default_value TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS help_text TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS min_value NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS max_value NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS min_length INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS max_length INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pattern TEXT DEFAULT NULL, -- Regex pattern
  ADD COLUMN IF NOT EXISTS step NUMERIC DEFAULT NULL, -- For number inputs
  ADD COLUMN IF NOT EXISTS min_date DATE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS max_date DATE DEFAULT NULL;

-- Update question_type constraint to include new types
ALTER TABLE role_questions 
  DROP CONSTRAINT IF EXISTS role_questions_question_type_check;

ALTER TABLE role_questions
  ADD CONSTRAINT role_questions_question_type_check 
  CHECK (question_type IN (
    'text', 'textarea', 'select', 'multiselect', 'checkbox', 'number', 'date',
    'email', 'url', 'phone', 'time', 'datetime', 'rating', 'radio', 'file'
  ));

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_role_questions_conditional ON role_questions USING GIN (conditional_logic);

-- Add comments for documentation
COMMENT ON COLUMN role_questions.conditional_logic IS 'JSON object defining when to show this question based on other answers';
COMMENT ON COLUMN role_questions.help_text IS 'Additional help text or instructions for the question';
COMMENT ON COLUMN role_questions.default_value IS 'Default value for the question';
COMMENT ON COLUMN role_questions.pattern IS 'Regex pattern for text validation';






