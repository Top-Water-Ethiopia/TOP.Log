BEGIN;

-- Ensure RLS is enabled (safe if already enabled)
ALTER TABLE public.captain_log_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_responses ENABLE ROW LEVEL SECURITY;

-- Create INSERT policy for users to insert their own entries if it is missing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'captain_log_entries'
      AND policyname = 'Users can insert their own entries'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Users can insert their own entries"
        ON public.captain_log_entries
        FOR INSERT
        TO authenticated
        WITH CHECK (
          auth.uid() = user_id
          AND (
            department_id IS NULL
            OR EXISTS (
              SELECT 1
              FROM public.user_department_roles udr
              WHERE udr.user_id = auth.uid()
                AND udr.department_id = captain_log_entries.department_id
                AND udr.is_active = TRUE
            )
          )
        )
    $policy$;
  END IF;
END
$$;

-- Create INSERT policy for users to insert their own custom responses if it is missing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'custom_responses'
      AND policyname = 'Users can insert their own responses'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Users can insert their own responses"
        ON public.custom_responses
        FOR INSERT
        TO authenticated
        WITH CHECK (
          EXISTS (
            SELECT 1
            FROM public.captain_log_entries cle
            WHERE cle.id = custom_responses.entry_id
              AND cle.user_id = auth.uid()
          )
        )
    $policy$;
  END IF;
END
$$;

COMMIT;
