# Debugging User Dropdown in Admin Reports

## Issue
Users dropdown in `/admin/reports` doesn't show users or filtering doesn't work.

## What Was Added

### 1. Enhanced Console Logging

**When page loads**, check browser console (F12) for:

```javascript
Loaded data: {
  entries: [...],
  users: [...],      // ← Should show ALL active users
  roles: [...],
  departments: [...]
}

Users for dropdown: [
  { id: "user-uuid-1", name: "John Doe", email: "john@example.com" },
  { id: "user-uuid-2", name: "Jane Smith", email: "jane@example.com" }
]

Roles for dropdown: [...]
Departments for dropdown: [...]
```

**When you select a user**, console shows:

```javascript
Selected user ID: "user-uuid-1"
All users: [{ id: "user-uuid-1", name: "John Doe", email: "john@example.com" }, ...]
```

### 2. Visual Feedback

After selecting a user, you'll see below the dropdown:
```
Filtering by: John Doe
```

### 3. Email Display in Dropdown

Users now show as:
```
John Doe (john@example.com)
Jane Smith (jane@example.com)
```

This helps identify users with similar names.

---

## How to Debug

### Step 1: Check if Users Are Being Fetched

1. Open `/admin/reports`
2. Open browser console (F12)
3. Look for: `Users for dropdown: [...]`

**Expected Result:**
```javascript
Users for dropdown: [
  { id: "uuid", name: "User Name", email: "user@example.com" }
]
```

**If array is empty `[]`:**
- API is not returning users
- Check server console
- Run SQL query to verify users exist

### Step 2: Check User Selection

1. Click the User dropdown
2. Select a user
3. Check console for: `Selected user ID: "uuid"`

**Expected Result:**
```javascript
Selected user ID: "299dfc32-f0ab-4ec6-bf1d-98c26754a448"
All users: [{ id: "299dfc32-...", name: "..." }]
```

### Step 3: Verify Filtering Logic

The filtering happens at line 219:
```typescript
if (selectedUser !== 'all') {
  filtered = filtered.filter(e => e.user_id === selectedUser)
}
```

**Add temporary debug log:**
```typescript
if (selectedUser !== 'all') {
  console.log('Filtering by user_id:', selectedUser)
  console.log('Entry user_ids:', entries.map(e => e.user_id))
  filtered = filtered.filter(e => e.user_id === selectedUser)
  console.log('Filtered results:', filtered.length)
}
```

### Step 4: Check Data Structure

**Verify entries have user_id:**
```javascript
// In console
console.log('Entries:', entries)
// Check each entry has:
{
  user_id: "uuid-here",
  user_profile: {
    name: "User Name",
    email: "user@example.com"
  }
}
```

---

## Common Issues & Solutions

### Issue 1: Dropdown is Empty (No Users)

**Symptoms:**
- User dropdown only shows "All users"
- Console shows: `Users for dropdown: []`

**Causes:**
1. No active users in database
2. API not returning users
3. RLS policy blocking user fetch

**Solutions:**

**A. Check database:**
```sql
-- Run in Supabase SQL Editor
SELECT 
  user_id, 
  name, 
  email, 
  is_active 
FROM user_profiles 
WHERE is_active = true
ORDER BY name;
```

If no results, you need to create users.

**B. Check API response:**
```bash
# Server console should show:
Fetched X entries, Y users, Z roles, W departments
```

If users = 0, check the API query.

**C. Check RLS policies:**
```sql
-- Verify admins can read user_profiles
SELECT * FROM user_profiles WHERE is_active = true;
```

If this fails, RLS policies need updating.

### Issue 2: Users Show But Filtering Doesn't Work

**Symptoms:**
- Dropdown shows users
- Selecting a user doesn't filter entries
- Console shows: `Filtered results: 0`

**Causes:**
1. Entry `user_id` doesn't match selected user ID
2. Case sensitivity mismatch
3. Data type mismatch

**Solutions:**

**A. Compare IDs:**
```javascript
// In browser console
console.log('Selected user ID:', selectedUser)
console.log('Entry user_ids:', entries.map(e => e.user_id))
// IDs should match exactly
```

**B. Check entry structure:**
```javascript
console.log('First entry:', entries[0])
// Should have: user_id, user_profile
```

**C. Manual test:**
```javascript
// Try manual filter
const testUserId = "299dfc32-f0ab-4ec6-bf1d-98c26754a448"
const result = entries.filter(e => e.user_id === testUserId)
console.log('Manual filter result:', result)
```

### Issue 3: Toast Shows "0 users" on Load

**Symptoms:**
- Toast message: "Loaded 1 entries, 0 users"
- Entries show but users dropdown is empty

**Cause:**
API is returning entries but not users in the response structure.

**Solution:**

Check API response format in `/api/admin/captain-log-entries/route.ts`:

```typescript
return NextResponse.json({
  entries: enrichedEntries,
  users: (allUsers as any[])?.map(u => ({
    id: u.user_id,
    name: u.name || 'Unknown User',
    email: u.email || '',
  })) || [],
  roles: [...],
  departments: [...]
})
```

Verify the API is returning this structure, not just an array.

### Issue 4: User Exists But Shows as "Unknown User"

**Symptoms:**
- Entry shows "Unknown User" 
- User exists in database

**Cause:**
User profile not linked to entry's user_id.

**Solution:**

```sql
-- Check if user_profile exists for entry's user_id
SELECT 
  e.id as entry_id,
  e.user_id,
  e.date,
  up.name,
  up.email
FROM captain_log_entries e
LEFT JOIN user_profiles up ON e.user_id = up.user_id
WHERE up.user_id IS NULL;
```

If results found, user_profile is missing. Create profile:

```sql
INSERT INTO user_profiles (user_id, name, email, role_id, is_active)
VALUES (
  'user-id-here',
  'User Name',
  'user@example.com',
  'role-id-here',
  true
);
```

---

## Testing Checklist

- [ ] Open `/admin/reports`
- [ ] Check console: `Users for dropdown` shows array
- [ ] Toast shows: "Loaded X entries, Y users" (Y > 0)
- [ ] User dropdown shows users with emails
- [ ] Select a user
- [ ] Console shows: `Selected user ID: "uuid"`
- [ ] Feedback text appears: "Filtering by: User Name"
- [ ] Entries are filtered (or show "No entries match")
- [ ] Clear filters button works
- [ ] Selecting "All users" shows all entries again

---

## Quick Fix Commands

### If no users in dropdown:

```sql
-- 1. Check users exist
SELECT COUNT(*) FROM user_profiles WHERE is_active = true;

-- 2. If 0, create test user profile
INSERT INTO user_profiles (user_id, name, email, role_id, is_active)
SELECT 
  id,
  COALESCE(email, 'User ' || id::text),
  email,
  '00000000-0000-0000-0000-000000000002'::UUID, -- User role
  true
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM user_profiles)
LIMIT 1;
```

### If filtering doesn't work:

```javascript
// In browser console
// 1. Check data
console.log('Entries:', entries)
console.log('All users:', allUsers)
console.log('Selected user:', selectedUser)

// 2. Manual filter test
const userId = allUsers[0]?.id
const filtered = entries.filter(e => e.user_id === userId)
console.log('Test filter:', filtered)

// 3. Check if user_id exists
entries.forEach(e => {
  console.log('Entry user_id:', e.user_id, 'Profile:', e.user_profile?.name)
})
```

---

## Success Indicators

✅ **Working correctly when:**

1. Console shows: `Users for dropdown: [{ id: "...", name: "...", email: "..." }]`
2. Toast shows: "Loaded X entries, Y users" (both > 0)
3. Dropdown shows: "User Name (user@example.com)"
4. Selecting user shows: "Filtering by: User Name"
5. Entries are filtered correctly
6. Console shows: `Selected user ID: "uuid"`
7. Filtered count matches expected results

---

## Additional Debugging

### Enable detailed filtering logs:

Add this to `admin-reports-view.tsx` after line 214:

```typescript
const filteredEntries = useMemo(() => {
  console.log('=== FILTERING DEBUG ===')
  console.log('Total entries:', entries.length)
  console.log('Selected user:', selectedUser)
  console.log('Selected department:', selectedDepartment)
  console.log('Selected role:', selectedRole)
  
  let filtered = [...entries]

  // Filter by user
  if (selectedUser !== 'all') {
    console.log('Filtering by user_id:', selectedUser)
    const before = filtered.length
    filtered = filtered.filter(e => {
      const matches = e.user_id === selectedUser
      if (!matches) {
        console.log('Entry', e.id, 'user_id', e.user_id, 'does not match', selectedUser)
      }
      return matches
    })
    console.log('After user filter:', filtered.length, '(was', before, ')')
  }
  
  // ... rest of filters
  
  console.log('Final filtered count:', filtered.length)
  console.log('======================')
  
  return filtered.sort(...)
}, [entries, selectedUser, selectedDepartment, selectedRole, dateRange, searchQuery])
```

This will show EXACTLY what's happening during filtering.

---

## Contact & Support

If issues persist:
1. Share browser console logs
2. Share server console logs  
3. Share SQL query results from debugging section
4. Provide screenshot of dropdown and console
