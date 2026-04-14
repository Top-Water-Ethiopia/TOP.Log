-- Migration: Fix RLS for captain_log_entries and custom_responses
-- Path: supabase/migrations/20260414120000_fix_log_entries_and_responses_select_rls.sql

BEGIN;

-- captain_log_entries: Users can view their own entries
-- We support both user_id and submitted_by_user_id for backward compatibility
DROP POLICY IF EXISTS "Users can view their own entries" ON public.captain_log_entries;
CREATE POLICY "Users can view their own entries"
  ON public.captain_log_entries FOR SELECT
  TO authenticated
  USING (
    auth.uid() = submitted_by_user_id 
    OR auth.uid() = user_id
  );

-- custom_responses: Users can view their own responses
DROP POLICY IF EXISTS "Users can view their own responses" ON public.custom_responses;
CREATE POLICY "Users can view their own responses"
  ON public.custom_responses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.captain_log_entries cle
      WHERE cle.id = custom_responses.entry_id
        AND (cle.submitted_by_user_id = auth.uid() OR cle.user_id = auth.uid())
    )
  );

COMMIT;
