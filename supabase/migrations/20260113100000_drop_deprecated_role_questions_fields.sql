BEGIN;

-- Backfill legacy_question_key into metadata before removing question_key column
UPDATE public.role_questions
SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('legacy_question_key', question_key)
WHERE question_key IS NOT NULL
  AND (
    metadata IS NULL
    OR NOT (metadata ? 'legacy_question_key')
    OR COALESCE(metadata->>'legacy_question_key', '') = ''
  );

-- Drop any unique constraint that depends on question_key
ALTER TABLE public.role_questions
  DROP CONSTRAINT IF EXISTS role_questions_role_id_question_key_key;

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname
  INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.role_questions'::regclass
    AND contype = 'u'
    AND pg_get_constraintdef(oid) LIKE '%(role_id, question_key)%'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.role_questions DROP CONSTRAINT IF EXISTS %I', constraint_name);
  END IF;
END $$;

-- Drop indexes that depend on columns being removed
DROP INDEX IF EXISTS public.idx_role_questions_conditional;

-- Drop deprecated columns
ALTER TABLE public.role_questions
  DROP COLUMN IF EXISTS question_key,
  DROP COLUMN IF EXISTS question_title,
  DROP COLUMN IF EXISTS help_text,
  DROP COLUMN IF EXISTS default_value,
  DROP COLUMN IF EXISTS conditional_logic;

COMMIT;
