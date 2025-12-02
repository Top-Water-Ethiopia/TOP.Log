# ✅ Fixed: Admin Reports Not Showing Entries (RLS Issue)

## 🐛 Problem

**Location:** `/admin/reports` page  
**Issue:** Admin users see "No Entries Yet" even though entries exist in the database  
**Root Cause:** Row-Level Security (RLS) policies blocking admin access to captain_log_entries

## 🔍 Root Cause Analysis

### The Problem

The `/api/admin/captain-log-entries` API was using **regular Supabase client** (`createClient()`), which is subject to RLS policies. Even though the user is an admin, RLS policies on the `captain_log_entries` and `custom_responses` tables were preventing access to other users' entries.

### Evidence from Logs

**On Hanna's side (regular user):**
```
Custom responses visible: 3 entries for entry_id: 5a97a06c-60d4-4a24-882d-d4d3fb1402d4
```

**On Super Admin side:**
```
Entries fetched: 0
Sample entry: undefined
Users fetched: 11

captain_log_entries?select=*&user_id=eq.ccb4613c-3e6d-4421-8b1c-3277280d658c&order=date.desc
Response: []
```

This shows that:
1. Entries exist in the database (Hanna can see her own)
2. RLS is blocking the admin from seeing other users' entries
3. User dropdown works (11 users fetched) but no entries shown

### Why This Happened

- The API used `supabase` (regular client) instead of `adminSupabase` (service role)
- Regular client is subject to RLS policies that restrict access based on `user_id`
- Admins need to see ALL entries, not just their own

---

## ✅ Solution

Changed the API to use `adminSupabase` (service role key) which **bypasses RLS policies** for both:
1. Fetching captain_log_entries
2. Fetching custom_responses

This allows admins to view all entries from all users in the organization.

---

## 📝 Changes Made

### File: `/app/api/admin/captain-log-entries/route.ts`

**Change 1: Use adminSupabase for captain_log_entries**
```typescript
// Before:
const { data: entries, error: entriesError } = await supabase
  .from('captain_log_entries')
  .select('*')
  .order('created_at', { ascending: false })

// After:
// Use adminSupabase to bypass RLS and get ALL entries for admin view
const { data: entries, error: entriesError } = await adminSupabase
  .from('captain_log_entries')
  .select('*')
  .order('created_at', { ascending: false })
```

**Change 2: Use adminSupabase for custom_responses**
```typescript
// Before:
const { data: customResponses, error: responsesError } = await supabase
  .from('custom_responses')
  .select('*')
  .in('entry_id', entryIds)
  .order('timestamp')

// After:
// Use adminSupabase to bypass RLS
const { data: customResponses, error: responsesError } = await adminSupabase
  .from('custom_responses')
  .select('*')
  .in('entry_id', entryIds)
  .order('timestamp')
```

---

## 🧪 Testing

After the fix, admins should now see:
- ✅ All captain log entries from all users
- ✅ User dropdown populated with all users
- ✅ Filtering by user works correctly
- ✅ All custom responses for each entry
- ✅ Dashboard statistics showing correct totals

---

## 📊 Expected Behavior

### Before Fix:
```
Entries fetched: 0
Sample entry: undefined
Users fetched: 11
```

### After Fix:
```
Entries fetched: 1 (or more depending on data)
Sample entry: { id: '5a97a06c-60d4-4a24-882d-d4d3fb1402d4', user_id: '...', ... }
Users fetched: 11
Custom responses fetched: 3 (for the entry)
```

---

## 🔐 Security Note

Using `adminSupabase` is safe in this context because:
1. The API already has admin authentication checks (lines 20-48)
2. Only users with `ADMIN_ROLE_ID` or `SUPER_ADMIN_ROLE_ID` can access this endpoint
3. Service role is only used server-side (never exposed to client)
4. This is a read-only admin reporting endpoint

---

## 🎯 Summary

**Root Cause:** RLS policies blocking admin access  
**Solution:** Use adminSupabase (service role) to bypass RLS for admin reports  
**Result:** Admins can now view all captain log entries from all users

---

## 🔄 Related Changes

All API queries in this endpoint now use `adminSupabase`:
- ✅ captain_log_entries fetch
- ✅ user_profiles fetch  
- ✅ roles fetch
- ✅ departments fetch
- ✅ custom_responses fetch
- ✅ auth.users fetch (for emails)

This ensures consistent admin access across all data needed for the reports dashboard.
