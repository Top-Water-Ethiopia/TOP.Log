-- Allow custom entry kinds to save while still enforcing agent subject consistency.
-- Phase 2 moved assigned-agent support to scope_entry_kinds.supports_assigned_agent,
-- so captain_log_entries can no longer hardcode entry_kind = 'agent_call'.

ALTER TABLE public.captain_log_entries
  DROP CONSTRAINT IF EXISTS captain_log_entries_agent_subject_check;

ALTER TABLE public.captain_log_entries
  ADD CONSTRAINT captain_log_entries_agent_subject_check
  CHECK (
    (
      subject_agent_id IS NULL
      AND subject_agent_snapshot IS NULL
    )
    OR (
      subject_agent_id IS NOT NULL
      AND subject_agent_snapshot IS NOT NULL
    )
  );

COMMENT ON CONSTRAINT captain_log_entries_agent_subject_check ON public.captain_log_entries IS
  'If a report references an agent, both subject_agent_id and subject_agent_snapshot must be present; otherwise both must be null.';
