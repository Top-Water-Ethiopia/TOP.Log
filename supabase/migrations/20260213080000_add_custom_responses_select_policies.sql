BEGIN;

-- Create SELECT policy for users to view their own custom responses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'custom_responses'
      AND policyname = 'Users can view their own responses'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Users can view their own responses"
        ON public.custom_responses
        FOR SELECT
        TO authenticated
        USING (
          EXISTS (
            SELECT 1
            FROM public.captain_log_entries cle
            WHERE cle.id = custom_responses.entry_id
              AND cle.user_id = auth.uid()
          )
          OR (
            -- Department leads/managers/supervisors can view responses from their department
            EXISTS (
              SELECT 1
              FROM public.captain_log_entries cle
              JOIN public.user_department_roles udr
                ON udr.department_id = cle.department_id
              WHERE cle.id = custom_responses.entry_id
                AND udr.user_id = auth.uid()
                AND udr.is_active = TRUE
                AND udr.role IN ('department-lead', 'department-manager', 'supervisor', 'viewer', 'department_lead', 'department_manager')
            )
          )
          OR (
            -- Admins can view all responses
            EXISTS (
              SELECT 1
              FROM public.user_profiles up
              WHERE up.user_id = auth.uid()
                AND up.role_id IN ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010')
            )
          )
        )
    $policy$;
  END IF;
END
$$;

-- Create UPDATE policy for users to update their own custom responses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'custom_responses'
      AND policyname = 'Users can update their own responses'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Users can update their own responses"
        ON public.custom_responses
        FOR UPDATE
        TO authenticated
        USING (
          EXISTS (
            SELECT 1
            FROM public.captain_log_entries cle
            WHERE cle.id = custom_responses.entry_id
              AND cle.user_id = auth.uid()
          )
        )
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

-- Create DELETE policy for users to delete their own custom responses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'custom_responses'
      AND policyname = 'Users can delete their own responses'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Users can delete their own responses"
        ON public.custom_responses
        FOR DELETE
        TO authenticated
        USING (
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
