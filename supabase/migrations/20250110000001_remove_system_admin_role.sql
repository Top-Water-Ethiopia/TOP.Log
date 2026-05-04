-- Migration: Remove System Admin Role
-- This migration removes the system-admin role and reassigns any system-admin users to admin

BEGIN;

-- 1. First, update any users with system-admin role to admin role
WITH updated_users AS (
  UPDATE user_profiles
  SET 
    role_id = '00000000-0000-0000-0000-000000000001', -- Standard admin role ID
    updated_at = NOW()
  WHERE role_id = '00000000-0000-0000-0000-000000000010' -- System admin role ID
  RETURNING user_id, role_id
)
SELECT 
  'Reassigned ' || COUNT(*) || ' users from system-admin to admin role' as message
FROM updated_users;

-- 2. Remove all permissions associated with system-admin role
WITH deleted_permissions AS (
  DELETE FROM permissions 
  WHERE role_id = '00000000-0000-0000-0000-000000000010'
  RETURNING id
)
SELECT 
  'Removed ' || COUNT(*) || ' permissions from system-admin role' as message
FROM deleted_permissions;

-- 3. Remove the system-admin role
DELETE FROM roles 
WHERE id = '00000000-0000-0000-0000-000000000010';

-- 4. Update any RLS policies or functions that reference system-admin
-- (This is a placeholder - add any specific policy updates needed)

-- 5. Create a notice about the change
DO $$
BEGIN
  RAISE NOTICE 'System-admin role has been removed. All system-admin users have been reassigned to admin role.';
END $$;

COMMIT;
