# Apply RLS Fix for Role Questions

This guide will help you fix the RLS (Row Level Security) policies for the `role_questions` table to allow super admin access.

## Problem

The RLS policies for `role_questions` table are blocking updates because they don't include support for super admin role (`00000000-0000-0000-0000-000000000000`).

## Solution

Run the SQL script to update the RLS policies. You have two options:

### Option 1: Use Supabase Dashboard (Recommended)

1. **Open Supabase Dashboard**:
   - Go to [supabase.com](https://supabase.com)
   - Select your project
   - Navigate to **SQL Editor** (left sidebar)

2. **Run the SQL Script**:
   - Open the file `QUICK_FIX_ROLE_QUESTIONS_RLS.sql` in this project
   - Copy the entire contents of the file
   - Paste it into the SQL Editor
   - Click **Run** (or press Cmd/Ctrl + Enter)

3. **Verify the Fix**:
   - The script will automatically verify that 5 policies were created
   - Check the output at the bottom for confirmation messages
   - You should see a list of policies with their names and commands

### Option 2: Use Supabase CLI

If you have Supabase CLI installed:

```bash
# Make sure you're in the project root
cd /Users/sam/Desktop/captain_log

# Run the SQL script
supabase db execute --file QUICK_FIX_ROLE_QUESTIONS_RLS.sql
```

### Option 3: Apply via Migration

If you want to apply this as a proper migration:

1. The migration file already exists at:
   ```
   supabase/migrations/20251119000005_ensure_role_questions_rls_for_super_admin.sql
   ```

2. If migrations are set up, ensure this migration has been applied. Check your migration status:
   ```bash
   supabase migration list
   ```

3. If it hasn't been applied, run:
   ```bash
   supabase migration up
   ```

## What the Fix Does

The SQL script:

1. **Drops existing policies** - Removes old policies that don't support super admin
2. **Creates new policies** that include:
   - Super admin role ID: `00000000-0000-0000-0000-000000000000`
   - Admin role ID: `00000000-0000-0000-0000-000000000001`
   - Proper `is_active` checks
3. **Verifies policies** - Confirms all 5 policies were created successfully

## Policies Created

1. **Users can view questions for their role** - Regular users see questions for their role
2. **Admins can view all role questions** - Admins and super admins see all questions
3. **Admins can create role questions** - Admins and super admins can create
4. **Admins can update role questions** - Admins and super admins can update
5. **Admins can delete role questions** - Admins and super admins can delete

## After Applying the Fix

1. **Refresh your browser** - Clear any cached permissions
2. **Try updating a question again** - The update should now work
3. **Check the console** - If there are still issues, the enhanced error messages will help diagnose

## Troubleshooting

### If the script fails:

1. **Check for existing policies**:
   ```sql
   SELECT policyname, cmd, qual, with_check
   FROM pg_policies 
   WHERE tablename = 'role_questions';
   ```

2. **Manually drop policies if needed**:
   ```sql
   DROP POLICY IF EXISTS "policy_name" ON role_questions;
   ```

3. **Verify your user profile**:
   ```sql
   SELECT user_id, role_id, is_active
   FROM user_profiles
   WHERE user_id = auth.uid();
   ```

### If updates still fail:

1. Verify your user has the correct role:
   ```sql
   SELECT up.user_id, up.role_id, up.is_active, r.name as role_name
   FROM user_profiles up
   JOIN roles r ON r.id = up.role_id
   WHERE up.user_id = 'your-user-id-here';
   ```

2. Check that your profile is active (`is_active = true`)

3. Verify the role_id matches one of:
   - Admin: `00000000-0000-0000-0000-000000000001`
   - Super Admin: `00000000-0000-0000-0000-000000000000`

## Need Help?

If you're still experiencing issues after applying this fix:

1. Check the browser console for detailed error messages
2. The enhanced diagnostics in the code will show exactly what RLS sees
3. Verify your user profile in the database has the correct role and is active

