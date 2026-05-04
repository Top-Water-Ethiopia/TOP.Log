BEGIN;

CREATE INDEX IF NOT EXISTS idx_captain_log_entries_agent_call_kpi
ON public.captain_log_entries (subject_department_id, date)
WHERE entry_kind = 'agent_call';

COMMIT;

