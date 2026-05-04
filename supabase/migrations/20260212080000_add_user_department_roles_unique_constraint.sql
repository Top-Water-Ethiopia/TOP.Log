-- Add unique constraint to ensure a user can only have one active department membership across all departments

-- First, drop any existing constraint if it exists to avoid conflicts
DROP INDEX IF EXISTS user_department_roles_one_active_membership_per_user;

-- Create the unique index without CONCURRENTLY (not supported in pipeline)
CREATE UNIQUE INDEX user_department_roles_one_active_membership_per_user 
ON public.user_department_roles 
USING btree (user_id) 
WHERE (is_active = true);

-- Add comment to document the constraint
COMMENT ON INDEX user_department_roles_one_active_membership_per_user IS 'Ensures each user can only have one active department membership across all departments';
