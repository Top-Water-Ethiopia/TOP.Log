BEGIN;

-- Add entry_kind column to role_questions
ALTER TABLE public.role_questions 
  ADD COLUMN IF NOT EXISTS entry_kind text NOT NULL DEFAULT 'standard';

-- Update existing questions that have assigned_agents option source to use 'agent_call'
UPDATE public.role_questions 
SET entry_kind = 'agent_call'
WHERE metadata->'option_source'->>'kind' = 'assigned_agents';

-- Update the entry_kind check constraint on captain_log_entries to include 'daily_summary'
ALTER TABLE public.captain_log_entries 
  DROP CONSTRAINT IF EXISTS captain_log_entries_entry_kind_check;

ALTER TABLE public.captain_log_entries 
  ADD CONSTRAINT captain_log_entries_entry_kind_check 
  CHECK (entry_kind IN ('standard', 'agent_call', 'daily_summary'));

-- Unique constraint for daily_summary (strictly once per day per user/department)
-- This is separate from the existing agent_call unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS captain_log_entries_daily_summary_unique
  ON public.captain_log_entries(submitted_by_user_id, subject_department_id, date)
  WHERE entry_kind = 'daily_summary';

-- Index for faster role_questions queries by entry_kind
CREATE INDEX IF NOT EXISTS idx_role_questions_entry_kind
  ON public.role_questions(entry_kind, department_id, is_active);

-- Index for faster captain_log_entries queries by entry_kind
CREATE INDEX IF NOT EXISTS idx_captain_log_entries_entry_kind
  ON public.captain_log_entries(entry_kind, submitted_by_user_id, date)
  WHERE entry_kind IN ('agent_call', 'daily_summary');

COMMIT;
