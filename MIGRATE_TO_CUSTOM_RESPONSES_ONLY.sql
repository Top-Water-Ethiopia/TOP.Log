-- ============================================================================
-- MIGRATION: Convert Captain Log to Custom Responses Only
-- ============================================================================
-- This migration removes predefined question columns from captain_log_entries
-- and migrates all existing data to custom_responses table.
-- After this, ALL questions (including standard ones) are stored as custom responses.
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Migrate existing data to custom_responses
-- ============================================================================

-- Migrate objectives
INSERT INTO public.custom_responses (entry_id, question_id, question_key, question_label, question_type, question_category, value, timestamp)
SELECT 
  id as entry_id,
  'std_objectives' as question_id,
  'objectives' as question_key,
  'Objectives' as question_label,
  'textarea' as question_type,
  'standard' as question_category,
  to_jsonb(objectives) as value,
  created_at as timestamp
FROM public.captain_log_entries
WHERE objectives IS NOT NULL AND objectives != ''
ON CONFLICT DO NOTHING;

-- Migrate key_results
INSERT INTO public.custom_responses (entry_id, question_id, question_key, question_label, question_type, question_category, value, timestamp)
SELECT 
  id as entry_id,
  'std_key_results' as question_id,
  'keyResults' as question_key,
  'Key Results' as question_label,
  'textarea' as question_type,
  'standard' as question_category,
  to_jsonb(key_results) as value,
  created_at as timestamp
FROM public.captain_log_entries
WHERE key_results IS NOT NULL AND key_results != ''
ON CONFLICT DO NOTHING;

-- Migrate challenges
INSERT INTO public.custom_responses (entry_id, question_id, question_key, question_label, question_type, question_category, value, timestamp)
SELECT 
  id as entry_id,
  'std_challenges' as question_id,
  'challenges' as question_key,
  'Challenges' as question_label,
  'textarea' as question_type,
  'standard' as question_category,
  to_jsonb(challenges) as value,
  created_at as timestamp
FROM public.captain_log_entries
WHERE challenges IS NOT NULL AND challenges != ''
ON CONFLICT DO NOTHING;

-- Migrate development_tasks
INSERT INTO public.custom_responses (entry_id, question_id, question_key, question_label, question_type, question_category, value, timestamp)
SELECT 
  id as entry_id,
  'std_development_tasks' as question_id,
  'developmentTasks' as question_key,
  'Development Tasks' as question_label,
  'textarea' as question_type,
  'standard' as question_category,
  to_jsonb(development_tasks) as value,
  created_at as timestamp
FROM public.captain_log_entries
WHERE development_tasks IS NOT NULL AND development_tasks != ''
ON CONFLICT DO NOTHING;

-- Migrate features_completed
INSERT INTO public.custom_responses (entry_id, question_id, question_key, question_label, question_type, question_category, value, timestamp)
SELECT 
  id as entry_id,
  'std_features_completed' as question_id,
  'featuresCompleted' as question_key,
  'Features Completed' as question_label,
  'textarea' as question_type,
  'standard' as question_category,
  to_jsonb(features_completed) as value,
  created_at as timestamp
FROM public.captain_log_entries
WHERE features_completed IS NOT NULL AND features_completed != ''
ON CONFLICT DO NOTHING;

-- Migrate challenges_and_blockers
INSERT INTO public.custom_responses (entry_id, question_id, question_key, question_label, question_type, question_category, value, timestamp)
SELECT 
  id as entry_id,
  'std_challenges_and_blockers' as question_id,
  'challengesAndBlockers' as question_key,
  'Challenges & Blockers' as question_label,
  'textarea' as question_type,
  'standard' as question_category,
  to_jsonb(challenges_and_blockers) as value,
  created_at as timestamp
FROM public.captain_log_entries
WHERE challenges_and_blockers IS NOT NULL AND challenges_and_blockers != ''
ON CONFLICT DO NOTHING;

-- Migrate code_and_priorities
INSERT INTO public.custom_responses (entry_id, question_id, question_key, question_label, question_type, question_category, value, timestamp)
SELECT 
  id as entry_id,
  'std_code_and_priorities' as question_id,
  'codeAndPriorities' as question_key,
  'Code Review & Priorities' as question_label,
  'textarea' as question_type,
  'standard' as question_category,
  to_jsonb(code_and_priorities) as value,
  created_at as timestamp
FROM public.captain_log_entries
WHERE code_and_priorities IS NOT NULL AND code_and_priorities != ''
ON CONFLICT DO NOTHING;

-- Migrate system_improvements
INSERT INTO public.custom_responses (entry_id, question_id, question_key, question_label, question_type, question_category, value, timestamp)
SELECT 
  id as entry_id,
  'std_system_improvements' as question_id,
  'systemImprovements' as question_key,
  'System Improvements' as question_label,
  'textarea' as question_type,
  'standard' as question_category,
  to_jsonb(system_improvements) as value,
  created_at as timestamp
FROM public.captain_log_entries
WHERE system_improvements IS NOT NULL AND system_improvements != ''
ON CONFLICT DO NOTHING;

-- Migrate project_updates
INSERT INTO public.custom_responses (entry_id, question_id, question_key, question_label, question_type, question_category, value, timestamp)
SELECT 
  id as entry_id,
  'std_project_updates' as question_id,
  'projectUpdates' as question_key,
  'Project Updates' as question_label,
  'textarea' as question_type,
  'standard' as question_category,
  to_jsonb(project_updates) as value,
  created_at as timestamp
FROM public.captain_log_entries
WHERE project_updates IS NOT NULL AND project_updates != ''
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 2: Drop the predefined columns from captain_log_entries
-- ============================================================================

ALTER TABLE public.captain_log_entries
  DROP COLUMN IF EXISTS objectives,
  DROP COLUMN IF EXISTS key_results,
  DROP COLUMN IF EXISTS challenges,
  DROP COLUMN IF EXISTS development_tasks,
  DROP COLUMN IF EXISTS features_completed,
  DROP COLUMN IF EXISTS challenges_and_blockers,
  DROP COLUMN IF EXISTS code_and_priorities,
  DROP COLUMN IF EXISTS system_improvements,
  DROP COLUMN IF EXISTS project_updates;

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check the new schema
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'captain_log_entries'
ORDER BY ordinal_position;

-- Count migrated responses
SELECT 
  question_key,
  question_label,
  COUNT(*) as response_count
FROM public.custom_responses
WHERE question_category = 'standard'
GROUP BY question_key, question_label
ORDER BY question_key;

-- ============================================================================
-- IMPORTANT NOTES
-- ============================================================================
-- After running this migration:
-- 1. Update TypeScript types to remove the dropped columns
-- 2. Update the compatibility layer in supabase-log-context.tsx
-- 3. All questions are now loaded from custom_responses table
-- 4. The captain_log_entries table only contains:
--    - id, user_id, date, created_at, updated_at, version, metadata
-- ============================================================================
