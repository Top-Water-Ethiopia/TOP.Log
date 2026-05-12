CREATE INDEX IF NOT EXISTS idx_captain_log_entries_review_department_date_created
ON public.captain_log_entries (subject_department_id, date DESC, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_captain_log_entries_review_department_kind_date_created
ON public.captain_log_entries (subject_department_id, entry_kind, date DESC, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_captain_log_entries_review_department_user_date_created
ON public.captain_log_entries (subject_department_id, user_id, date DESC, created_at DESC, id DESC);

