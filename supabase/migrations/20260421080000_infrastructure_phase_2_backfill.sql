-- Migration: Infrastructure Phase 2: Backfill (Version 3)
-- Description: Snapshot templates and link entries with proper joins.

BEGIN;

-- 1. Create initial snapshots for all existing scope_entry_kinds
WITH inserted_versions AS (
    INSERT INTO public.entry_kind_versions (
        scope_entry_kind_id, 
        version, 
        ui_schema, 
        render_schema_version, 
        created_at
    )
    SELECT 
        id, 
        1, 
        jsonb_build_object(
            'label', label,
            'icon', icon,
            'color', color,
            'description', description,
            'entry_kind', entry_kind
        ),
        1,
        created_at
    FROM public.scope_entry_kinds
    ON CONFLICT (scope_entry_kind_id, version) DO NOTHING
    RETURNING id, scope_entry_kind_id
)
-- 2. Create question set versions for each newly created version
-- Joining scope_entry_kinds -> roles -> role_questions
INSERT INTO public.question_set_versions (
    entry_kind_version_id,
    questions,
    created_at
)
SELECT 
    iv.id,
    COALESCE(
        (
            SELECT jsonb_agg(rq.*)
            FROM public.role_questions rq
            JOIN public.scope_entry_kinds sek ON sek.id = iv.scope_entry_kind_id
            LEFT JOIN public.roles r ON r.name = sek.department_profession_id AND r.type = 'profession'
            WHERE rq.department_id = sek.department_id
            AND (
                -- Case 1: Department-wide scope (both null)
                (sek.department_profession_id IS NULL AND rq.department_profession_id IS NULL)
                -- Case 2: Profession scope (match by role ID)
                OR (rq.department_profession_id = r.id)
            )
            AND rq.entry_kind = sek.entry_kind
        ),
        '[]'::jsonb
    ),
    now()
FROM inserted_versions iv;

-- 3. Link historical entries to snapshots
-- DANGER: This is an approximation for existing data.
UPDATE public.captain_log_entries cle
SET 
    entry_kind_version_id = ekv.id,
    question_set_version_id = qsv.id,
    submitted_for_date = cle.created_at::date
FROM public.scope_entry_kinds sek
JOIN public.entry_kind_versions ekv ON ekv.scope_entry_kind_id = sek.id AND ekv.version = 1
JOIN public.question_set_versions qsv ON qsv.entry_kind_version_id = ekv.id
WHERE cle.subject_department_id = sek.department_id
AND cle.entry_kind = sek.entry_kind
AND (
    (sek.department_profession_id IS NULL)
);

-- 4. Update capability flags
UPDATE public.scope_entry_kinds
SET 
  has_profession_sections = (department_profession_id IS NOT NULL),
  has_department_sections = (department_profession_id IS NULL);

COMMIT;
