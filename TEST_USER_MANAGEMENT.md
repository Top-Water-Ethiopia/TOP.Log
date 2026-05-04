# User Management Testing Checklist

## Prerequisites
- ✅ Admin user exists and is logged in
- ✅ User management page is accessible at `/admin/users`

## Test Cases

### 1. View Users List
**Test:** Navigate to `/admin/users` and verify you can see the list of users

**Expected:**
- [ ] User list loads without errors
- [ ] Can see user names, emails, roles, and status
- [ ] Can filter by role and status
- [ ] Can search users by name/email

**If it fails:**
- Check browser console for errors
- Verify RLS policies allow admins to SELECT from user_profiles
- Run: `supabase/migrations/20251117094000_fix_user_profiles_policies.sql`

---

### 2. Create New User
**Test:** Click "Create User" button and create a new user

**Steps:**
1. Click "Create User" or "+" button
2. Fill in:
   - Name: "Test User"
   - Email: "testuser@example.com"
   - Password: "testpassword123"
   - Role: Select a role (e.g., "user")
   - Department: Optional
3. Click "Create" or "Save"

**Expected:**
- [ ] User is created successfully
- [ ] Success toast message appears
- [ ] New user appears in the list
- [ ] User can log in with the created credentials

**If it fails:**
- Check browser console for error details
- Verify RLS policy allows admins to INSERT into user_profiles
- Check if email already exists
- Verify password meets requirements (min 8 characters)

---

### 3. Update User Role
**Test:** Change a user's role

**Steps:**
1. Find a user in the list
2. Click on the role dropdown/button
3. Select a different role
4. Confirm the change

**Expected:**
- [ ] Role updates successfully
- [ ] Success toast message appears
- [ ] Updated role is reflected in the list
- [ ] User's permissions change accordingly

**If it fails:**
- Check browser console for error details
- Verify RLS policy allows admins to UPDATE user_profiles
- Verify the role exists in the roles table

---

### 4. Toggle User Status (Activate/Deactivate)
**Test:** Activate or deactivate a user

**Steps:**
1. Find a user in the list
2. Click the status toggle/button
3. Confirm the change

**Expected:**
- [ ] Status updates successfully
- [ ] Success toast message appears
- [ ] Updated status is reflected in the list
- [ ] Deactivated users cannot log in

**If it fails:**
- Check browser console for error details
- Verify RLS policy allows admins to UPDATE user_profiles
- Verify you're not trying to deactivate yourself

---

### 5. Delete User (if implemented)
**Test:** Delete a user from the system

**Steps:**
1. Find a user in the list
2. Click delete/trash icon
3. Confirm deletion

**Expected:**
- [ ] User is deleted successfully
- [ ] Success toast message appears
- [ ] User is removed from the list
- [ ] User cannot log in anymore

**If it fails:**
- Check browser console for error details
- Verify RLS policy allows admins to DELETE from user_profiles (if implemented)
- Check for foreign key constraints

---

## Common Issues & Solutions

### Issue: "Permission denied" or RLS error
**Solution:** Run the migration:
```sql
-- File: supabase/migrations/20251117094000_fix_user_profiles_policies.sql
```

### Issue: Cannot see user list
**Check:**
1. Are you logged in as admin?
2. Does your profile have `role_id = '00000000-0000-0000-0000-000000000001'`?
3. Is `is_active = true` in your profile?

### Issue: Cannot create users
**Check:**
1. RLS policy for INSERT on user_profiles
2. Email format is valid
3. Password meets requirements
4. User doesn't already exist

### Issue: Cannot update users
**Check:**
1. RLS policy for UPDATE on user_profiles
2. You're not trying to update yourself to a non-admin role
3. The role you're assigning exists

---

## SQL Queries for Verification

### Check your admin status:
```sql
SELECT 
  up.user_id,
  up.name,
  up.role_id,
  up.is_active,
  r.name as role_name
FROM user_profiles up
JOIN roles r ON r.id = up.role_id
WHERE up.user_id = auth.uid();
```

### Check user_profiles policies:
```sql
SELECT policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'user_profiles'
ORDER BY policyname;
```

### Check all users (as admin):
```sql
SELECT 
  up.user_id,
  up.name,
  up.role_id,
  up.is_active,
  r.name as role_name
FROM user_profiles up
JOIN roles r ON r.id = up.role_id
ORDER BY up.created_at DESC;
```

---

## Next Steps After Testing

Once user management is confirmed working:
1. ✅ Test departments management
2. ✅ Test role management
3. ✅ Test other admin features






