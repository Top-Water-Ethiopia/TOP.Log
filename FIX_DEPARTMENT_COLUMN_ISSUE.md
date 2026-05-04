# ✅ Fixed: department_id Column Does Not Exist

## 🐛 Problem

**Error:**
```
Error fetching all users: {
  code: '42703',
  details: null,
  hint: 'Perhaps you meant to reference the column "user_profiles.department".',
  message: 'column user_profiles.department_id does not exist'
}
```

**Root Cause:** The `user_profiles` table uses `department` (TEXT) not `department_id` (UUID).

---

## 📊 Database Schema

### `user_profiles` Table Structure:
```sql
create table public.user_profiles (
  id uuid,
  user_id uuid,
  name text,
  department text,              ← TEXT field (not UUID foreign key)
  role_id uuid,                 ← UUID foreign key to roles
  is_active boolean,
  created_at timestamp,
  updated_at timestamp,
  metadata jsonb,
  last_login timestamp
)
```

**Key Insight:**
- `role_id` → UUID reference to `roles` table ✅
- `department` → TEXT field (not a foreign key) ✅

---

## 🔧 Solution

### Change 1: Update SELECT Query
**Before:**
```typescript
.select('user_id, name, role_id, department_id')  // ❌ department_id doesn't exist
```

**After:**
```typescript
.select('user_id, name, role_id, department')  // ✅ Use department (text)
```

### Change 2: Update userMap Creation
**Before:**
```typescript
department_name: deptMap.get(u.department_id) || null  // ❌ Wrong field
```

**After:**
```typescript
department_name: u.department || null  // ✅ Use department directly
```

---

## ✅ Expected Behavior

### API Response
```json
{
  "users": [
    {
      "id": "user-uuid",
      "name": "Admin",
      "email": "admin@example.com"
    }
  ],
  "entries": [
    {
      "user_profile": {
        "user_id": "...",
        "name": "Hanna Samuel",
        "email": "hanna@example.com",
        "role_name": "quality-engineer",
        "department_name": "Engineering"  ← Text value directly
      }
    }
  ]
}
```

---

## 🧪 Testing

1. **Refresh** `/admin/reports`
2. **Check server console** - should see:
   ```
   ✅ Fetched users for dropdown: 12
   ✅ Fetched roles for dropdown: 6
   ✅ Fetched departments for dropdown: 2
   ```
3. **No error messages** ✅
4. **User dropdown** shows all 12 users ✅
5. **Entry details** show department names ✅

---

**Status:** ✅ **FIXED**
