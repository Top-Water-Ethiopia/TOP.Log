-- Create reports and report_answers tables with RLS policies
-- This allows all authenticated users to create and view reports

BEGIN;

-- Create reports table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create report_answers table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.report_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.report_questions(id) ON DELETE CASCADE,
  answer TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(report_id, question_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON public.reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports(created_at);
CREATE INDEX IF NOT EXISTS idx_report_answers_report_id ON public.report_answers(report_id);
CREATE INDEX IF NOT EXISTS idx_report_answers_question_id ON public.report_answers(question_id);

-- Enable Row Level Security
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_answers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "All users can create reports" ON public.reports;
DROP POLICY IF EXISTS "All users can view all reports" ON public.reports;
DROP POLICY IF EXISTS "Users can update their own reports" ON public.reports;
DROP POLICY IF EXISTS "Users can delete their own reports" ON public.reports;
DROP POLICY IF EXISTS "All users can create report answers" ON public.report_answers;
DROP POLICY IF EXISTS "All users can view report answers" ON public.report_answers;
DROP POLICY IF EXISTS "Users can update their own report answers" ON public.report_answers;

-- RLS Policies for reports table
-- Allow all authenticated users to create reports
CREATE POLICY "All users can create reports"
  ON public.reports
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Allow all authenticated users to view all reports
CREATE POLICY "All users can view all reports"
  ON public.reports
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Allow users to update their own reports
CREATE POLICY "Users can update their own reports"
  ON public.reports
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own reports
CREATE POLICY "Users can delete their own reports"
  ON public.reports
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for report_answers table
-- Allow all authenticated users to create report answers
CREATE POLICY "All users can create report answers"
  ON public.report_answers
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.reports
      WHERE reports.id = report_answers.report_id
      AND reports.user_id = auth.uid()
    )
  );

-- Allow all authenticated users to view all report answers
CREATE POLICY "All users can view report answers"
  ON public.report_answers
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Allow users to update their own report answers
CREATE POLICY "Users can update their own report answers"
  ON public.report_answers
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.reports
      WHERE reports.id = report_answers.report_id
      AND reports.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.reports
      WHERE reports.id = report_answers.report_id
      AND reports.user_id = auth.uid()
    )
  );

-- Add permissions for reports to all user roles
-- Admin role already has full access, but let's add explicit permissions
INSERT INTO public.permissions (id, role_id, resource, action)
VALUES
  -- Admin permissions for reports (full access)
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'reports', 'create'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'reports', 'read'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'reports', 'update'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'reports', 'delete'),
  -- Standard user permissions for reports (create and read)
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'reports', 'create'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'reports', 'read'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'reports', 'update'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'reports', 'delete')
ON CONFLICT (role_id, resource, action) DO NOTHING;

-- Create triggers for updating timestamps (using existing update_timestamp function)
DROP TRIGGER IF EXISTS update_reports_timestamp_trigger ON public.reports;
CREATE TRIGGER update_reports_timestamp_trigger
  BEFORE UPDATE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS update_report_answers_timestamp_trigger ON public.report_answers;
CREATE TRIGGER update_report_answers_timestamp_trigger
  BEFORE UPDATE ON public.report_answers
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

COMMIT;

