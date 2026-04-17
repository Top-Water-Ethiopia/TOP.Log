-- Canonical availability predicate for submitter-facing entry kinds.
-- A kind is available for a report_date iff:
--   is_active AND is_available AND within optional date window AND within optional allowed_weekdays.
--
-- Notes:
-- - allowed_weekdays uses ISO day-of-week: 1=Mon ... 7=Sun.
-- - NULL or empty allowed_weekdays means "no weekday restriction".

BEGIN;

CREATE OR REPLACE FUNCTION public.is_entry_kind_available(
  p_is_active boolean,
  p_is_available boolean,
  p_start_date date,
  p_end_date date,
  p_allowed_weekdays smallint[],
  p_report_date date
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    COALESCE(p_is_active, false) = true
    AND COALESCE(p_is_available, false) = true
    AND (p_start_date IS NULL OR p_start_date <= p_report_date)
    AND (p_end_date IS NULL OR p_end_date >= p_report_date)
    AND (
      p_allowed_weekdays IS NULL
      OR array_length(p_allowed_weekdays, 1) IS NULL
      OR extract(isodow from p_report_date)::smallint = ANY (p_allowed_weekdays)
    );
$$;

COMMIT;
