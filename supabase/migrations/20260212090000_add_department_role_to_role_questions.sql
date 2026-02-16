-- Add department_role column to role_questions for department-specific role questions
-- This replaces the old role_id system with department_role keys

-- 1) Add the new column
ALTER TABLE role_questions 
ADD COLUMN department_role text null;

-- 2) Drop the old check constraint
ALTER TABLE role_questions 
DROP CONSTRAINT IF EXISTS role_questions_scope_check;

-- 3) Add the new constraint (exactly one of department_id or department_role must be set)
ALTER TABLE role_questions 
ADD CONSTRAINT role_questions_scope_check 
CHECK (
  (department_id IS NULL) <> (department_role IS NULL)
);

-- 4) Optional: drop role_id FK if you plan to deprecate it
-- Uncomment if you want to remove the old role_id foreign key
-- ALTER TABLE role_questions DROP CONSTRAINT IF EXISTS role_questions_role_id_fkey;

-- 5) Add index for department_role
CREATE INDEX IF NOT EXISTS idx_role_questions_department_role 
ON role_questions(department_role) 
WHERE department_role IS NOT NULL;

-- 6) Add composite index for department_role + display_order
CREATE INDEX IF NOT EXISTS idx_role_questions_department_role_display_order 
ON role_questions(department_role, display_order) 
WHERE department_role IS NOT NULL;
