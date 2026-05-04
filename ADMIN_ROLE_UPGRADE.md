# Admin Role Upgrade (2025-01-10)

## Changes Made

1. **Removed Super-Admin Role**
   - The `super-admin` role has been deprecated in favor of the standard `admin` role
   - All super-admin users have been automatically reassigned to the admin role
   - The `super-admin` role and its permissions have been removed from the system

2. **New Migration**
   - Added `20250110000000_remove_super_admin_role.sql` to handle the transition
   - This migration safely reassigns users and cleans up the role/permissions

3. **Updated Admin Management**
   - New script: `scripts/set-admin.ts` - Use this to grant admin privileges
   - Removed old `set-super-admin.ts` and `verify-superadmin-dashboard.js` scripts

## How to Grant Admin Access

1. Use the new script:

   ```bash
   # Install dependencies if needed
   yarn add ts-node typescript @types/node

   # Grant admin access to a user
   ts-node scripts/set-admin.ts user@example.com
   ```

2. The user will need to log out and back in for changes to take effect

## Verification

1. Check admin access by visiting `/admin`
2. Verify role assignments in the `user_profiles` table
3. Check that the `super-admin` role is removed from the `roles` table

## Rollback (if needed)

If you need to rollback, you can re-run the original migration:

```sql
-- Recreate super-admin role
INSERT INTO roles (id, name, description)
VALUES ('00000000-0000-0000-0000-000000000000', 'super-admin', 'Super Administrator')
ON CONFLICT (name) DO NOTHING;

-- Reassign any admins back to super-admin if needed
-- UPDATE user_profiles
-- SET role_id = '00000000-0000-0000-0000-000000000000'
-- WHERE role_id = '00000000-0000-0000-0000-000000000001';
```

## Next Steps

- [ ] Update any documentation that referenced the super-admin role
- [ ] Test admin workflows to ensure all functionality works as expected
- [ ] Remove any remaining super-admin references in tests and documentation
