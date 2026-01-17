-- Drop and recreate role_questions table with proper RLS policies
-- This migration completely removes and recreates the table to fix RLS issues

BEGIN;

-- ============================================================================
-- STEP 1: Drop all dependent objects first
-- ============================================================================

-- Drop all policies on role_questions
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'role_questions'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.role_questions', policy_record.policyname);
  END LOOP;
END $$;

-- Drop any triggers on role_questions
DROP TRIGGER IF EXISTS update_role_questions_timestamp ON public.role_questions;

-- Drop indexes (will be recreated)
DROP INDEX IF EXISTS public.idx_role_questions_role_id;
DROP INDEX IF EXISTS public.idx_role_questions_active;
DROP INDEX IF EXISTS public.idx_role_questions_display_order;
DROP INDEX IF EXISTS public.idx_role_questions_conditional;

-- Drop foreign key constraints by dropping the table
-- This will cascade to any dependent objects
DROP TABLE IF EXISTS public.role_questions CASCADE;

-- ============================================================================
-- STEP 2: Recreate the role_questions table with complete schema
-- ============================================================================

CREATE TABLE public.role_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  question_key TEXT NOT NULL,
  question_label TEXT NOT NULL,
  question_type TEXT NOT NULL,
  question_description TEXT,
  placeholder TEXT,
  options JSONB DEFAULT NULL,
  is_required BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  validation_rules JSONB DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  -- Advanced features columns
  conditional_logic JSONB DEFAULT NULL,
  default_value TEXT DEFAULT NULL,
  help_text TEXT DEFAULT NULL,
  min_value NUMERIC DEFAULT NULL,
  max_value NUMERIC DEFAULT NULL,
  min_length INTEGER DEFAULT NULL,
  max_length INTEGER DEFAULT NULL,
  pattern TEXT DEFAULT NULL,
  step NUMERIC DEFAULT NULL,
  min_date DATE DEFAULT NULL,
  max_date DATE DEFAULT NULL,
  -- Unique constraint: one question_key per role
  UNIQUE(role_id, question_key)
);

-- ============================================================================
-- STEP 3: Create indexes for better performance
-- ============================================================================

CREATE INDEX idx_role_questions_role_id ON public.role_questions(role_id);
CREATE INDEX idx_role_questions_active ON public.role_questions(is_active) WHERE is_active = true;
CREATE INDEX idx_role_questions_display_order ON public.role_questions(role_id, display_order);
CREATE INDEX idx_role_questions_conditional ON public.role_questions USING GIN (conditional_logic);

-- ============================================================================
-- STEP 4: Add check constraint for question_type
-- ============================================================================

ALTER TABLE public.role_questions
  ADD CONSTRAINT role_questions_question_type_check 
  CHECK (question_type IN (
    'text', 'textarea', 'select', 'multiselect', 'checkbox', 'number', 'date',
    'email', 'url', 'phone', 'time', 'datetime', 'rating', 'radio', 'file'
  ));

-- ============================================================================
-- STEP 5: Enable Row Level Security
-- ============================================================================

ALTER TABLE public.role_questions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 6: Create RLS policies using is_admin_or_super_admin function
-- ============================================================================

-- Regular users can view active questions for their role
CREATE POLICY "Users can view questions for their role"
  ON public.role_questions FOR SELECT
  TO authenticated
  USING (
    is_active = true AND
    role_id IN (
      SELECT role_id 
      FROM public.user_profiles 
      WHERE user_id = auth.uid() 
      AND is_active = true
    )
  );

-- Admins and super admins can view ALL questions (including inactive)
CREATE POLICY "Admins can view all role questions"
  ON public.role_questions FOR SELECT
  TO authenticated
  USING (public.is_admin_or_super_admin(auth.uid()));

-- Admins and super admins can create questions
CREATE POLICY "Admins can create role questions"
  ON public.role_questions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_super_admin(auth.uid()));

-- Admins and super admins can update questions
CREATE POLICY "Admins can update role questions"
  ON public.role_questions FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_super_admin(auth.uid()))
  WITH CHECK (public.is_admin_or_super_admin(auth.uid()));

-- Admins and super admins can delete questions
CREATE POLICY "Admins can delete role questions"
  ON public.role_questions FOR DELETE
  TO authenticated
  USING (public.is_admin_or_super_admin(auth.uid()));

-- ============================================================================
-- STEP 7: Create trigger for updating timestamps
-- ============================================================================

CREATE TRIGGER update_role_questions_timestamp
  BEFORE UPDATE ON public.role_questions
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

-- ============================================================================
-- STEP 8: Add comments for documentation
-- ============================================================================

COMMENT ON TABLE public.role_questions IS 'Questions associated with specific roles for reports and forms';
COMMENT ON COLUMN public.role_questions.conditional_logic IS 'JSON object defining when to show this question based on other answers';
COMMENT ON COLUMN public.role_questions.help_text IS 'Additional help text or instructions for the question';
COMMENT ON COLUMN public.role_questions.default_value IS 'Default value for the question';
COMMENT ON COLUMN public.role_questions.pattern IS 'Regex pattern for text validation';

COMMIT;

-- Verify the table was created correctly
SELECT 
  'role_questions table created' as status,
  COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'role_questions';

-- Verify RLS policies
SELECT 
  policyname,
  cmd,
  CASE 
    WHEN qual IS NOT NULL THEN 'USING clause present'
    ELSE 'No USING clause'
  END as using_status,
  CASE 
    WHEN with_check IS NOT NULL THEN 'WITH CHECK clause present'
    ELSE 'No WITH CHECK clause'
  END as with_check_status
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'role_questions'
ORDER BY cmd, policyname;

