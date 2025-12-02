# Testing Admin Reports

## ✅ What Was Fixed

### 1. **API Endpoint Improvements** (`/api/admin/captain-log-entries`)
- ✅ Fixed Supabase relation queries that weren't working
- ✅ Now uses separate explicit queries for profiles, roles, and departments
- ✅ Proper data joining with lookup maps
- ✅ Better error handling with detailed error messages
- ✅ Added console logging for debugging
- ✅ Returns empty array instead of error when no entries exist

### 2. **Frontend Improvements** (`AdminReportsView`)
- ✅ Added refresh button with loading state
- ✅ Better error messages showing actual error details
- ✅ Success toast showing number of entries loaded
- ✅ Console logging for debugging
- ✅ Handles empty data gracefully
- ✅ Header showing total entry count

## 🧪 How to Test

### Step 1: Check Dev Server
1. Make sure dev server is running on http://localhost:3000 (or 3001)
2. If it's not running, start it: `npm run dev`

### Step 2: Login as Admin
1. Go to http://localhost:3000/login
2. Login with admin credentials
3. Navigate to http://localhost:3000/admin

### Step 3: Access Admin Reports
1. Click "Captain Log Entries" (first quick action card - emerald color)
2. OR navigate directly to http://localhost:3000/admin/reports

### Step 4: Verify Data Loading
**Expected Behavior:**
- ✅ You should see a "Refresh" button at top right
- ✅ Loading spinner while fetching
- ✅ Success toast: "Loaded X entries"
- ✅ Dashboard tab shows statistics
- ✅ All Entries tab shows individual entries

**Check Browser Console (F12):**
```
Loaded entries: [...]  // Should show array of entries
```

**Check Server Console:**
```
Fetched X entries, Y profiles, Z responses
```

### Step 5: Test Filtering
1. Switch to "All Entries" tab
2. Try each filter:
   - **Search**: Type user name or content
   - **User Filter**: Select a specific user
   - **Department Filter**: Select a department
   - **Role Filter**: Select a role
   - **Date Range**: Try "Last 7 days", "Last 30 days", etc.

### Step 6: Test Exports
1. Apply some filters (optional)
2. Click "Export JSON" - Should download JSON file
3. Click "Export CSV" - Should download CSV file
4. Open files to verify data is correct

### Step 7: Test Entry Details
1. Click on any entry card
2. Entry should expand showing all questions and answers
3. Click again to collapse
4. Verify all custom responses are displayed

## 🔍 Debugging

### If No Entries Show Up

**1. Check API Response:**
```javascript
// Open browser console (F12)
// Navigate to Network tab
// Go to /admin/reports
// Look for request to /api/admin/captain-log-entries
// Check the Response tab
```

**2. Check Database:**
```sql
-- Run in Supabase SQL Editor
SELECT COUNT(*) FROM captain_log_entries;
SELECT COUNT(*) FROM custom_responses;
SELECT COUNT(*) FROM user_profiles;
```

**3. Check Console Logs:**
- **Browser Console**: Should show "Loaded entries: [...]"
- **Server Console**: Should show "Fetched X entries, Y profiles, Z responses"

### If Filters Don't Work

**Check the filteredEntries in console:**
```javascript
// Add this temporarily in admin-reports-view.tsx
console.log('Filtered entries:', filteredEntries)
console.log('Filter options:', filterOptions)
```

### If User Names Show as "Unknown User"

**This means:**
- User profile doesn't exist for that user_id
- Run this to check:
```sql
SELECT 
  e.id,
  e.user_id,
  up.name,
  up.email
FROM captain_log_entries e
LEFT JOIN user_profiles up ON e.user_id = up.user_id
WHERE up.user_id IS NULL;
```

### If Role/Department Shows as "Unknown" or null

**Check if roles/departments exist:**
```sql
-- Check roles
SELECT DISTINCT r.id, r.name
FROM user_profiles up
JOIN roles r ON up.role_id = r.id;

-- Check departments
SELECT DISTINCT d.id, d.name
FROM user_profiles up
JOIN departments d ON up.department_id = d.id;
```

## 📊 Expected Data Structure

### API Response Format:
```json
[
  {
    "id": "entry-uuid",
    "user_id": "user-uuid",
    "date": "2025-11-27",
    "created_at": "2025-11-27T10:30:00Z",
    "updated_at": "2025-11-27T10:30:00Z",
    "version": 1,
    "metadata": null,
    "user_profile": {
      "user_id": "user-uuid",
      "name": "John Doe",
      "email": "john@example.com",
      "role_name": "Engineer",
      "department_name": "Development"
    },
    "custom_responses": [
      {
        "question_id": "std_objectives",
        "question_key": "objectives",
        "question_label": "Objectives",
        "question_type": "textarea",
        "value": "Complete user authentication"
      }
    ]
  }
]
```

## 🎯 Success Criteria

✅ **All tests pass when:**
1. Admin can access /admin/reports without errors
2. Dashboard shows correct statistics
3. All Entries tab shows entries with user names, emails, roles, departments
4. Filters work correctly
5. Search works
6. Exports (JSON and CSV) download with correct data
7. Entry expansion/collapse works
8. Refresh button reloads data
9. No console errors

## 🚀 Next Steps

If everything works:
1. Test with different admin users
2. Test with large datasets (100+ entries)
3. Test export with filtered data
4. Verify permissions (non-admin shouldn't access)

If there are issues:
1. Check console logs (browser and server)
2. Verify database has data
3. Check RLS policies allow admin access
4. Review error messages in API responses
