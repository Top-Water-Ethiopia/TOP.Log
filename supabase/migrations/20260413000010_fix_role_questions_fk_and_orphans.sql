BEGIN;

-- Remap orphaned department_profession_ids that pointed to old dept_professions
-- UUIDs to the correct rows in the new unified roles table.
UPDATE role_questions
SET department_profession_id = (SELECT id FROM roles WHERE name = 'sales-promoter' AND type = 'profession' LIMIT 1)
WHERE department_profession_id = 'eb4bb51e-f49f-4990-9629-a1fc7a8e4819';

UPDATE role_questions
SET department_profession_id = (SELECT id FROM roles WHERE name = 'social-worker' AND type = 'profession' LIMIT 1)
WHERE department_profession_id = '61efd4f3-2e71-4a2d-9ac1-5a6d1f88fce0';

-- Nullify any remaining orphaned department_profession_id values that don't map to a role
UPDATE role_questions
SET department_profession_id = NULL
WHERE department_profession_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM roles WHERE id = role_questions.department_profession_id);

-- Add FK: role_questions.department_profession_id -> roles.id
ALTER TABLE role_questions
  DROP CONSTRAINT IF EXISTS role_questions_department_profession_id_fkey;

ALTER TABLE role_questions
  ADD CONSTRAINT role_questions_department_profession_id_fkey
  FOREIGN KEY (department_profession_id)
  REFERENCES roles(id)
  ON DELETE SET NULL;

-- Signal PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;
