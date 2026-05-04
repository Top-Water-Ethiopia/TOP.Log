# ✅ Fixed: Email Column Does Not Exist Error

## 🐛 Problem

**Error:**
```
Error fetching all users: {
  code: '42703',
  details: null,
  hint: null,
  message: 'column user_profiles.email does not exist'
}
```

**Root Cause:** The `user_profiles` table doesn't have an `email` column. Emails are stored in the `auth.users` table (managed by Supabase Auth).

---

## 📊 Database Schema

### `user_profiles` Table Columns:
- `id` ✅
- `user_id` ✅
- `name` ✅
- `department` ✅
- `role_id` ✅
- `is_active` ✅
- `created_at` ✅
- `updated_at` ✅
- `metadata` ✅
- `last_login` ✅
- ~~`email`~~ ❌ **NOT IN TABLE**

### Where Email Lives:
- **`auth.users` table** (Supabase managed)
  - `id` → matches `user_profiles.user_id`
  - `email` ← **This is where emails are stored**

---

## 🔧 Solution

Changed the API to:
1. Fetch `user_profiles` **without** email column
2. Fetch emails separately from `auth.users` using admin client
3. Map emails to users using `user_id`

### Code Changes

#### Step 1: Remove email from user_profiles query
```typescript
// Before (❌ Error)
const { data: allUsers } = await adminSupabase
  .from('user_profiles')
  .select('user_id, name, email, role_id, department_id')  // ❌ email doesn't exist
  
// After (✅ Fixed)
const { data: allUsers } = await adminSupabase
  .from('user_profiles')
  .select('user_id, name, role_id, department_id')  // ✅ Removed email
```

#### Step 2: Fetch emails from auth.users
```typescript
// NEW: Fetch emails from auth.users
let userEmailMap = new Map<string, string>()
if (allUsers && allUsers.length > 0) {
  const userIds = (allUsers as any[]).map(u => u.user_id)
  const { data: authUsers } = await adminSupabase.auth.admin.listUsers()
  
  if (authUsers?.users) {
    authUsers.users.forEach(authUser => {
      if (userIds.includes(authUser.id)) {
        userEmailMap.set(authUser.id, authUser.email || '')
      }
    })
  }
}
```

#### Step 3: Use email map in responses
```typescript
// When returning users
users: (allUsers as any[])?.map(u => ({
  id: u.user_id,
  name: u.name || 'Unknown User',
  email: userEmailMap.get(u.user_id) || '',  // ✅ Get email from map
}))

// When creating user profile map
const userMap = new Map(
  (allUsers as any[])?.map(u => [
    u.user_id,
    {
      user_id: u.user_id,
      name: u.name || 'Unknown User',
      email: userEmailMap.get(u.user_id) || '',  // ✅ Get email from map
      role_name: roleMap.get(u.role_id) || 'Unknown',
      department_name: deptMap.get(u.department_id) || null,
    }
  ])
)
```

---

## ✅ Expected Behavior Now

### API Response
```json
{
  "entries": [...],
  "users": [
    {
      "id": "user-uuid-1",
      "name": "Admin",
      "email": "admin@example.com"  ← Now includes email
    },
    {
      "id": "user-uuid-2",
      "name": "Hanna Samuel",
      "email": "hanna@example.com"  ← Now includes email
    }
    // ... 10 more users with emails
  ],
  "roles": [...],
  "departments": [...]
}
```

### User Dropdown
Should now show:
```
Admin (admin@example.com)
Hanna Samuel (hanna@example.com)
Designer One (designer1@example.com)
...
```

---

## 🧪 Testing

### Test 1: Check Server Logs
After refresh, server console should show:
```
✅ Fetched users for dropdown: 12
✅ Fetched roles for dropdown: 6
✅ Fetched departments for dropdown: 2
```

**No error messages** ✅

### Test 2: Check Browser Console
```
=== API RESPONSE DEBUG ===
Users count: 12
Users data: [
  {
    "id": "...",
    "name": "Admin",
    "email": "admin@example.com"  ← Should have email now
  },
  ...
]
=========================
```

### Test 3: Check Dropdown
1. Go to `/admin/reports`
2. Switch to "All Entries" tab
3. Click User dropdown
4. Should see 12 users with format: **"Name (email)"**

---

## 📋 Files Modified

**File:** `/app/api/admin/captain-log-entries/route.ts`

**Changes:**
1. ✅ Removed `email` from `user_profiles` query
2. ✅ Added email fetching from `auth.users`
3. ✅ Created `userEmailMap` to map user IDs to emails
4. ✅ Updated all places that use email to get from map

**Lines Changed:** ~20 lines

---

## 🔍 Why This Approach?

### Why Not Add Email to user_profiles?
**Reason:** Supabase Auth manages the `auth.users` table. Email is authentication data and should stay there. Duplicating it in `user_profiles` would:
- ❌ Create data redundancy
- ❌ Risk data inconsistency
- ❌ Require sync logic when emails change
- ❌ Violate single source of truth principle

### Why Use Admin API?
**Reason:** The `adminSupabase.auth.admin.listUsers()` method:
- ✅ Has access to all users (bypasses RLS)
- ✅ Returns email and other auth data
- ✅ Is designed for admin operations
- ✅ Is secure (service role key required)

---

## ✅ Success Criteria

After this fix:
- ✅ No "column email does not exist" error
- ✅ API returns 12 users with emails
- ✅ User dropdown shows all users with emails
- ✅ Dropdown displays as "Name (email)" format
- ✅ Filtering by user works
- ✅ Entry details show user email

---

## 🎯 Summary

| Before | After |
|--------|-------|
| ❌ Error: email column doesn't exist | ✅ Fetches email from auth.users |
| ❌ Dropdown empty/broken | ✅ Dropdown shows all 12 users |
| ❌ No email display | ✅ Shows "Name (email)" |

**Status:** ✅ **FIXED**  
**Date:** November 27, 2025
