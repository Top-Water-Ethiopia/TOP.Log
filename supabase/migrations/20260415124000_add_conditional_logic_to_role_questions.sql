-- Add conditional logic (visibility rules) to role_questions
-- Stored as JSONB so the admin UI and runtime form engine can evaluate consistently.

ALTER TABLE public.role_questions
  ADD COLUMN IF NOT EXISTS conditional_logic jsonb;

