-- Extend update_scope_entry_kinds_bulk RPC to accept and upsert allowed_weekdays.
-- Default normalization remains based on is_active/is_default only.

BEGIN;

CREATE OR REPLACE FUNCTION public.update_scope_entry_kinds_bulk(
  p_department_id UUID,
  p_scope_type entry_kind_scope_type_enum,
  p_profession_role_id UUID,
  p_configs JSONB,
  p_updated_by UUID
)
RETURNS SETOF public.scope_entry_kinds
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_default_id UUID;
  v_active_count INTEGER;
BEGIN
  IF p_department_id IS NULL THEN
    RAISE EXCEPTION 'department_id is required';
  END IF;

  IF p_scope_type = 'profession_personal' AND p_profession_role_id IS NULL THEN
    RAISE EXCEPTION 'profession_role_id is required for profession_personal scope';
  END IF;

  IF p_scope_type <> 'profession_personal' THEN
    -- For department-scoped targets, profession_role_id must be null
    p_profession_role_id := NULL;
  END IF;

  -- Validate configs payload
  IF p_configs IS NULL OR jsonb_typeof(p_configs) <> 'array' THEN
    RAISE EXCEPTION 'configs must be a JSON array';
  END IF;

  -- Upsert each config by id (pk). New rows may omit id.
  INSERT INTO public.scope_entry_kinds (
    id,
    department_id,
    department_profession_id,
    scope_type,
    profession_role_id,
    entry_kind,
    label,
    description,
    sort_order,
    is_default,
    is_active,
    is_available,
    available_start_date,
    available_end_date,
    allowed_weekdays,
    supports_assigned_agent,
    allow_multiple_per_day,
    color,
    icon,
    updated_by,
    created_by
  )
  SELECT
    COALESCE(NULLIF((c->>'id')::text, '')::uuid, gen_random_uuid()) AS id,
    p_department_id,
    NULL, -- legacy field not used in new targets
    p_scope_type,
    p_profession_role_id,
    (c->>'entry_kind')::text,
    (c->>'label')::text,
    NULLIF((c->>'description')::text, '')::text,
    COALESCE((c->>'sort_order')::int, 0),
    COALESCE((c->>'is_default')::boolean, false),
    COALESCE((c->>'is_active')::boolean, true),
    COALESCE((c->>'is_available')::boolean, true),
    NULLIF((c->>'available_start_date')::text, '')::date,
    NULLIF((c->>'available_end_date')::text, '')::date,
    CASE
      WHEN c ? 'allowed_weekdays' AND jsonb_typeof(c->'allowed_weekdays') = 'array' THEN (
        SELECT COALESCE(array_agg(DISTINCT (value::text)::smallint ORDER BY (value::text)::smallint), ARRAY[]::smallint[])
        FROM jsonb_array_elements(c->'allowed_weekdays') AS value
        WHERE (value::text)::smallint BETWEEN 1 AND 7
      )
      ELSE NULL
    END AS allowed_weekdays,
    COALESCE((c->>'supports_assigned_agent')::boolean, false),
    COALESCE((c->>'allow_multiple_per_day')::boolean, false),
    NULLIF((c->>'color')::text, '')::text,
    NULLIF((c->>'icon')::text, '')::text,
    p_updated_by,
    p_updated_by
  FROM jsonb_array_elements(p_configs) AS c
  ON CONFLICT (id) DO UPDATE SET
    scope_type = EXCLUDED.scope_type,
    profession_role_id = EXCLUDED.profession_role_id,
    entry_kind = EXCLUDED.entry_kind,
    label = EXCLUDED.label,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    is_default = EXCLUDED.is_default,
    is_active = EXCLUDED.is_active,
    is_available = EXCLUDED.is_available,
    available_start_date = EXCLUDED.available_start_date,
    available_end_date = EXCLUDED.available_end_date,
    allowed_weekdays = EXCLUDED.allowed_weekdays,
    supports_assigned_agent = EXCLUDED.supports_assigned_agent,
    allow_multiple_per_day = EXCLUDED.allow_multiple_per_day,
    color = EXCLUDED.color,
    icon = EXCLUDED.icon,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();

  -- Normalize empty weekday arrays to NULL (treat [] and NULL identically)
  UPDATE public.scope_entry_kinds
  SET allowed_weekdays = NULL
  WHERE (
      (p_scope_type = 'profession_personal' AND department_id = p_department_id AND scope_type = p_scope_type AND profession_role_id = p_profession_role_id)
      OR (p_scope_type <> 'profession_personal' AND department_id = p_department_id AND scope_type = p_scope_type AND department_profession_id IS NULL)
    )
    AND allowed_weekdays IS NOT NULL
    AND array_length(allowed_weekdays, 1) IS NULL;

  -- Compute active count for target
  IF p_scope_type = 'profession_personal' THEN
    SELECT COUNT(*) INTO v_active_count
    FROM public.scope_entry_kinds
    WHERE department_id = p_department_id
      AND scope_type = p_scope_type
      AND profession_role_id = p_profession_role_id
      AND is_active = TRUE;
  ELSE
    SELECT COUNT(*) INTO v_active_count
    FROM public.scope_entry_kinds
    WHERE department_id = p_department_id
      AND scope_type = p_scope_type
      AND department_profession_id IS NULL
      AND is_active = TRUE;
  END IF;

  -- Enforce default when active exists
  IF v_active_count > 0 THEN
    IF p_scope_type = 'profession_personal' THEN
      SELECT id INTO v_default_id
      FROM public.scope_entry_kinds
      WHERE department_id = p_department_id
        AND scope_type = p_scope_type
        AND profession_role_id = p_profession_role_id
        AND is_active = TRUE
        AND is_default = TRUE
      ORDER BY sort_order ASC, label ASC
      LIMIT 1;

      UPDATE public.scope_entry_kinds
      SET is_default = FALSE
      WHERE department_id = p_department_id
        AND scope_type = p_scope_type
        AND profession_role_id = p_profession_role_id;
    ELSE
      SELECT id INTO v_default_id
      FROM public.scope_entry_kinds
      WHERE department_id = p_department_id
        AND scope_type = p_scope_type
        AND department_profession_id IS NULL
        AND is_active = TRUE
        AND is_default = TRUE
      ORDER BY sort_order ASC, label ASC
      LIMIT 1;

      UPDATE public.scope_entry_kinds
      SET is_default = FALSE
      WHERE department_id = p_department_id
        AND scope_type = p_scope_type
        AND department_profession_id IS NULL;
    END IF;

    IF v_default_id IS NULL THEN
      IF p_scope_type = 'profession_personal' THEN
        SELECT id INTO v_default_id
        FROM public.scope_entry_kinds
        WHERE department_id = p_department_id
          AND scope_type = p_scope_type
          AND profession_role_id = p_profession_role_id
          AND is_active = TRUE
        ORDER BY sort_order ASC, label ASC
        LIMIT 1;
      ELSE
        SELECT id INTO v_default_id
        FROM public.scope_entry_kinds
        WHERE department_id = p_department_id
          AND scope_type = p_scope_type
          AND department_profession_id IS NULL
          AND is_active = TRUE
        ORDER BY sort_order ASC, label ASC
        LIMIT 1;
      END IF;
    END IF;

    UPDATE public.scope_entry_kinds
    SET is_default = TRUE
    WHERE id = v_default_id;
  END IF;

  IF p_scope_type = 'profession_personal' THEN
    RETURN QUERY
      SELECT *
      FROM public.scope_entry_kinds
      WHERE department_id = p_department_id
        AND scope_type = p_scope_type
        AND profession_role_id = p_profession_role_id
      ORDER BY sort_order ASC, label ASC;
  ELSE
    RETURN QUERY
      SELECT *
      FROM public.scope_entry_kinds
      WHERE department_id = p_department_id
        AND scope_type = p_scope_type
        AND department_profession_id IS NULL
      ORDER BY sort_order ASC, label ASC;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_scope_entry_kinds_bulk(UUID, entry_kind_scope_type_enum, UUID, JSONB, UUID) TO authenticated;

COMMIT;
