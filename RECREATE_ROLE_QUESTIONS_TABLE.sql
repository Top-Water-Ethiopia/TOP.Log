-- QUICK FIX: Drop and recreate role_questions table with proper RLS
-- Run this in Supabase SQL Editor to completely recreate the table
-- WARNING: This will delete all existing role_questions data!

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

-- Drop any triggers
DROP TRIGGER IF EXISTS update_role_questions_timestamp ON public.role_questions;

-- Drop indexes
DROP INDEX IF EXISTS idx_role_questions_role_id ON public.role_questions;
DROP INDEX IF EXISTS idx_role_questions_active ON public.role_questions;
DROP INDEX IF EXISTS idx_role_questions_display_order ON public.role_questions;
DROP INDEX IF EXISTS idx_role_questions_conditional ON public.role_questions;

-- Drop the table (cascades to dependent objects)
DROP TABLE IF EXISTS public.role_questions CASCADE;

-- ============================================================================
-- STEP 2: Recreate the role_questions table
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
  -- Advanced features
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
  UNIQUE(role_id, question_key)
);

-- ============================================================================
-- STEP 3: Create indexes
-- ============================================================================

CREATE INDEX idx_role_questions_role_id ON public.role_questions(role_id);
CREATE INDEX idx_role_questions_active ON public.role_questions(is_active) WHERE is_active = true;
CREATE INDEX idx_role_questions_display_order ON public.role_questions(role_id, display_order);
CREATE INDEX idx_role_questions_conditional ON public.role_questions USING GIN (conditional_logic);

-- ============================================================================
-- STEP 4: Add constraints
-- ============================================================================

ALTER TABLE public.role_questions
  ADD CONSTRAINT role_questions_question_type_check 
  CHECK (question_type IN (
    'text', 'textarea', 'select', 'multiselect', 'checkbox', 'number', 'date',
    'email', 'url', 'phone', 'time', 'datetime', 'rating', 'radio', 'file', 'image'
  ));

-- ============================================================================
-- STEP 5: Enable RLS
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

-- Admins and super admins can view ALL questions
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
-- STEP 7: Create trigger for timestamps
-- ============================================================================

CREATE TRIGGER update_role_questions_timestamp
  BEFORE UPDATE ON public.role_questions
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

COMMIT;

-- Verify creation
SELECT 
  '✅ role_questions table recreated successfully' as status,
  COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'role_questions';

-- List all policies
SELECT 
  policyname,
  cmd,
  '✅ Policy created' as status
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'role_questions'
ORDER BY cmd, policyname;
