-- Migration: Remove Super Admin Role
-- This migration removes the super-admin role and reassigns any super-admin users to admin

BEGIN;

-- 1. First, update any users with super-admin role to admin role
WITH updated_users AS (
  UPDATE user_profiles
  SET 
    role_id = '00000000-0000-0000-0000-000000000001', -- Standard admin role ID
    updated_at = NOW()
  WHERE role_id = '00000000-0000-0000-0000-000000000000' -- Super admin role ID
  RETURNING user_id, role_id
)
SELECT 
  'Reassigned ' || COUNT(*) || ' users from super-admin to admin role' as message
FROM updated_users;

-- 2. Remove all permissions associated with super-admin role
WITH deleted_permissions AS (
  DELETE FROM permissions 
  WHERE role_id = '00000000-0000-0000-0000-000000000000'
  RETURNING id
)
SELECT 
  'Removed ' || COUNT(*) || ' permissions from super-admin role' as message
FROM deleted_permissions;

-- 3. Finally, remove the super-admin role
DELETE FROM roles 
WHERE id = '00000000-0000-0000-0000-000000000000';

-- 4. Create a notice about the change
DO $$
BEGIN
  RAISE NOTICE 'Super-admin role has been removed. All super-admin users have been reassigned to admin role.';
END $$;

COMMIT;
