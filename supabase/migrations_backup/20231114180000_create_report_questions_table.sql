-- Create a function to safely create the report_questions table
CREATE OR REPLACE FUNCTION public.create_report_questions_table_if_not_exists()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Create the table if it doesn't exist
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE  table_schema = 'public'
    AND    table_name   = 'report_questions'
  ) THEN
    CREATE TABLE public.report_questions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      question_key TEXT NOT NULL,
      question_label TEXT NOT NULL,
      question_type TEXT NOT NULL,
      question_category TEXT,
      role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(role_id, question_key)
    );

    -- Add index for faster lookups
    CREATE INDEX idx_report_questions_role_id ON public.report_questions(role_id);

    -- Set up Row Level Security
    ALTER TABLE public.report_questions ENABLE ROW LEVEL SECURITY;

    -- Create policies
    CREATE POLICY "Enable read access for all users" 
      ON public.report_questions
      FOR SELECT
      USING (true);

    CREATE POLICY "Enable insert for admins" 
      ON public.report_questions
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.user_id = auth.uid()
          AND user_profiles.role_id = '00000000-0000-0000-0000-000000000001' -- admin role
        )
      );

    RAISE NOTICE 'Created report_questions table';
  ELSE
    RAISE NOTICE 'report_questions table already exists';
  END IF;
END;
$$;

-- Call the function to create the table
SELECT public.create_report_questions_table_if_not_exists();
