-- Add search-by-name feature for department leads
-- Phase 1: Create indexes and RPC function

-- Enable pg_trgm extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create trigram index for efficient partial search on user names
CREATE INDEX IF NOT EXISTS idx_user_profiles_name_trgm
ON user_profiles USING gin (name gin_trgm_ops);

-- Fallback functional index if trigram not available (optional)
CREATE INDEX IF NOT EXISTS idx_user_profiles_name_lower
ON user_profiles (LOWER(name));

-- Composite index for user-scoped queries (user_id, date DESC, id DESC)
CREATE INDEX IF NOT EXISTS idx_logs_user_date_id
ON captain_log_entries (user_id, date DESC, id DESC);

-- Index for general cursor queries (date DESC, id DESC)
CREATE INDEX IF NOT EXISTS idx_logs_date_id
ON captain_log_entries (date DESC, id DESC);

-- Create RPC function for search with cursor pagination
DROP FUNCTION IF EXISTS search_logs(uuid,date,text,text,double precision,date,uuid,integer,boolean);
CREATE OR REPLACE FUNCTION search_logs(
  p_user_id uuid,
  p_date date DEFAULT NULL,
  p_department_id text DEFAULT NULL,
  p_search_name text DEFAULT NULL,
  p_similarity_threshold float DEFAULT NULL,
  p_cursor_date date DEFAULT NULL,
  p_cursor_id uuid DEFAULT NULL,
  p_limit int DEFAULT 30,
  p_can_view_department_logs boolean DEFAULT false
)
RETURNS TABLE (
  id uuid,
  date date,
  subject_department_id text,
  created_at timestamptz,
  updated_at timestamptz,
  entry_kind text,
  subject_agent_snapshot jsonb,
  user_id uuid,
  user_name text,
  department_name text,
  response_count int
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_accessible_depts uuid[];
BEGIN
  -- Set DB-level timeout at function start (protects everything)
  PERFORM set_config('statement_timeout', '5s', true);

  -- Get accessible departments if not viewing all
  IF NOT p_can_view_department_logs THEN
    -- User only sees their own logs - no dept filtering needed
    v_accessible_depts := ARRAY[]::uuid[];
  ELSEIF p_department_id IS NOT NULL THEN
    -- Verify department is in accessible depts (security fix)
    SELECT ARRAY_AGG(d.id) INTO v_accessible_depts
    FROM departments d
    WHERE d.id = p_department_id::uuid
    AND d.id IN (
      SELECT department_id FROM user_department_memberships udm
      WHERE udm.user_id = p_user_id
      AND udm.is_active = true
    );
    -- If dept not accessible, return empty
    IF v_accessible_depts IS NULL THEN
      v_accessible_depts := ARRAY[]::uuid[];
    END IF;
  ELSE
    SELECT ARRAY_AGG(d.id) INTO v_accessible_depts
    FROM departments d
    WHERE d.id IN (
      SELECT department_id FROM user_department_memberships udm
      WHERE udm.user_id = p_user_id
      AND udm.is_active = true
    );
  END IF;

  -- Ensure NULL-safe array handling
  v_accessible_depts := COALESCE(v_accessible_depts, ARRAY[]::uuid[]);

  -- Early exit if no accessible departments (optimization)
  IF p_can_view_department_logs AND cardinality(v_accessible_depts) = 0 THEN
    RETURN;
  END IF;

  -- Guard against excessive limit values
  p_limit := LEAST(p_limit, 100);

  RETURN QUERY
  SELECT
    e.id,
    e.date,
    e.subject_department_id::text,
    e.created_at,
    e.updated_at,
    e.entry_kind,
    e.subject_agent_snapshot,
    e.user_id,
    up.name as user_name,
    d.name as department_name,
    (SELECT COUNT(*) FROM custom_responses cr WHERE cr.entry_id = e.id)::int as response_count
  FROM captain_log_entries e
  JOIN user_profiles up ON e.user_id = up.user_id
  LEFT JOIN departments d ON e.subject_department_id = d.id
  WHERE
    -- Permission filtering (wrapped to fix precedence)
    (
      (p_can_view_department_logs = false AND e.user_id = p_user_id)
      OR
      (p_can_view_department_logs = true AND (
        (p_department_id IS NULL AND e.subject_department_id = ANY(v_accessible_depts))
        OR (p_department_id IS NOT NULL AND e.subject_department_id = p_department_id::uuid AND e.subject_department_id = ANY(v_accessible_depts))
      ))
    )
    -- Date filter (applies to all branches due to wrapping)
    AND (p_date IS NULL OR e.date = p_date)
    -- Search filter: similarity with adaptive threshold (stricter for short names)
    -- Searches both user name and agent name (from subject_agent_snapshot)
    AND (p_search_name IS NULL OR
      similarity(up.name, p_search_name) >=
      CASE
        WHEN length(p_search_name) < 3 THEN COALESCE(p_similarity_threshold, 0.3)
        ELSE COALESCE(p_similarity_threshold, 0.2)
      END
      OR
      similarity(e.subject_agent_snapshot->>'name', p_search_name) >=
      CASE
        WHEN length(p_search_name) < 3 THEN COALESCE(p_similarity_threshold, 0.3)
        ELSE COALESCE(p_similarity_threshold, 0.2)
      END
    )
    -- Cursor pagination (date-based only - ranking disabled for cursor stability)
    AND (p_cursor_date IS NULL OR (
      e.date < p_cursor_date
      OR (e.date = p_cursor_date AND e.id < p_cursor_id)
    ))
  ORDER BY
    -- Ranking only on first page (when cursor is NULL)
    -- Use the maximum similarity between user name and agent name
    CASE WHEN p_search_name IS NOT NULL AND p_cursor_date IS NULL THEN
      GREATEST(
        similarity(up.name, p_search_name),
        similarity(e.subject_agent_snapshot->>'name', p_search_name)
      )
    ELSE 0 END DESC,
    e.date DESC,
    e.id DESC
  LIMIT p_limit + 1;
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION search_logs TO authenticated;
