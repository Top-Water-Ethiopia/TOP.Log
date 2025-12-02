# 📊 Database Schema Analysis & Recommendations

Based on `all.sql` - Complete analysis of your current database structure

---

## 🗄️ **Current Tables (8 Active + 5 Should Remove)**

### ✅ **ACTIVE TABLES (Keep These - 8 tables)**

#### 1. **`user_profiles`** ✅ KEEP
```sql
Columns:
  - id (uuid, PK)
  - user_id (uuid, FK → auth.users, UNIQUE)
  - name (text, NOT NULL)
  - department (text, NULL)                    ← TEXT field (not FK)
  - role_id (uuid, FK → roles, NOT NULL)
  - is_active (boolean, default true)
  - created_at, updated_at (timestamps)
  - metadata (jsonb)
  - last_login (timestamp)
```

**Issues Found:**
- ❌ `department` is TEXT, not a foreign key to `departments` table
- ❌ No `email` field (email is in `auth.users`)

**Recommendations:**
1. **Option A: Keep as is** (simple, flexible)
   - Department is free-text
   - No referential integrity
   - ✅ Current code works with this

2. **Option B: Add `department_id` FK** (recommended for data integrity)
   ```sql
   ALTER TABLE user_profiles 
   ADD COLUMN department_id UUID REFERENCES departments(id);
   
   -- Migrate existing data
   UPDATE user_profiles up
   SET department_id = d.id
   FROM departments d
   WHERE up.department = d.name;
   
   -- Drop old column
   ALTER TABLE user_profiles DROP COLUMN department;
   ```

3. **Option C: Add `email` column** (for faster queries, but creates duplication)
   ```sql
   ALTER TABLE user_profiles ADD COLUMN email TEXT;
   ```
   ⚠️ Not recommended - email should stay in `auth.users` (single source of truth)

---

#### 2. **`roles`** ✅ KEEP
```sql
Columns:
  - id (uuid, PK)
  - name (text, UNIQUE, NOT NULL)
  - description (text)
  - created_at, updated_at (timestamps)
  - department_id (uuid, FK → departments)     ← Roles can belong to departments
```

**Status:** ✅ Perfect - properly structured

**Note:** Missing `level` field that your code references!

**Recommendation:**
```sql
ALTER TABLE roles ADD COLUMN level INTEGER DEFAULT 1;

-- Set levels for existing roles
UPDATE roles SET level = 5 WHERE name = 'super-admin';
UPDATE roles SET level = 4 WHERE name = 'admin';
UPDATE roles SET level = 3 WHERE name = 'manager';
UPDATE roles SET level = 2 WHERE name = 'user';
UPDATE roles SET level = 1 WHERE name = 'viewer';
```

---

#### 3. **`departments`** ✅ KEEP
```sql
Columns:
  - id (uuid, PK)
  - name (text, UNIQUE, NOT NULL)
  - code (text)
  - description (text)
  - is_active (boolean, default true)
  - created_by, updated_by (uuid, FK → auth.users)
  - created_at, updated_at (timestamps)
  - metadata (jsonb)
```

**Status:** ✅ Perfect - well structured

---

#### 4. **`captain_log_entries`** ✅ KEEP (PRIMARY SYSTEM)
```sql
Columns:
  - id (uuid, PK)
  - user_id (uuid, NOT NULL)
  - date (date, NOT NULL)
  - version (integer, default 1)
  - metadata (jsonb)
  - created_at, updated_at (timestamps)
  
Constraints:
  - UNIQUE(user_id, date)  ← One entry per user per day
```

**Status:** ✅ Perfect - this is your main system

**Note:** Missing FK constraint to `auth.users`

**Recommendation:**
```sql
ALTER TABLE captain_log_entries 
ADD CONSTRAINT captain_log_entries_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
```

---

#### 5. **`custom_responses`** ✅ KEEP (PRIMARY SYSTEM)
```sql
Columns:
  - id (uuid, PK)
  - entry_id (uuid, FK → captain_log_entries, NOT NULL)
  - question_id (text, NOT NULL)
  - question_key (text, NOT NULL)
  - question_label (text, NOT NULL)
  - question_type (text, NOT NULL)
  - question_category (text, default 'standard')
  - value (jsonb)
  - timestamp (timestamp)
```

**Status:** ✅ Perfect - stores all question responses

---

#### 6. **`role_questions`** ✅ KEEP
```sql
Columns: (extensive - 30 fields!)
  - id, role_id, question_key, question_label, question_type
  - question_description, placeholder, options (jsonb)
  - is_required, display_order, validation_rules (jsonb)
  - is_active, created_by, updated_by
  - metadata (jsonb), conditional_logic (jsonb)
  - default_value, help_text
  - min_value, max_value, min_length, max_length
  - pattern, step, min_date, max_date, question_title
  
Constraints:
  - UNIQUE(role_id, question_key)
```

**Status:** ✅ Very comprehensive - great for dynamic forms

---

#### 7. **`permissions`** ✅ KEEP (for future)
```sql
Columns:
  - id (uuid, PK)
  - role_id (uuid, FK → roles, NOT NULL)
  - resource (text, NOT NULL)
  - action (text, NOT NULL)
  - conditions (jsonb)
  - created_at, updated_at
  
Constraints:
  - UNIQUE(role_id, resource, action)
```

**Status:** ✅ Defined but not actively used yet

**Recommendation:** Start using this for fine-grained access control

---

#### 8. **`audit_logs`** ✅ KEEP (for compliance)
```sql
Columns:
  - id (uuid, PK)
  - timestamp (timestamp, default now())
  - operation (text, NOT NULL)
  - entity_id (text, NOT NULL)
  - changes (jsonb)
  - metadata (jsonb)
  - user_id (uuid, FK → auth.users)
```

**Status:** ✅ Defined but not actively logging yet

**Recommendation:** Implement audit logging for compliance

---

### ❌ **TABLES TO REMOVE (Already cleaned from code - 5 tables)**

#### 9. **`reports`** ❌ **REMOVE**
```sql
Duplicate of captain_log_entries
Currently still in all.sql but deleted from DB
```
**Action:** Already removed ✅

---

#### 10. **`report_answers`** ❌ **REMOVE**
```sql
Duplicate of custom_responses
Currently still in all.sql but deleted from DB
```
**Action:** Already removed ✅

---

#### 11. **`report_questions`** ❌ **REMOVE**
```sql
Duplicate of role_questions
Currently still in all.sql but deleted from DB
```
**Action:** Already removed ✅

---

#### 12. **`department_questions`** ❌ **REMOVE**
```sql
Not used anywhere in code
References department as TEXT (not FK)
```
**Action:** Already removed ✅

---

#### 13. **`admins`** ❌ **REMOVE**
```sql
Redundant - admin status determined by roles.level
Currently still in all.sql but deleted from DB
```
**Action:** Already removed ✅

---

## 🔍 **Schema Issues & Recommendations**

### Issue #1: `user_profiles.department` is TEXT, not FK

**Current:**
```sql
user_profiles.department → TEXT field
```

**Problem:**
- No referential integrity
- Can have typos ("Engineering" vs "engineering")
- No relationship to `departments` table

**Recommendation:**
```sql
-- Add department_id column
ALTER TABLE user_profiles 
ADD COLUMN department_id UUID REFERENCES departments(id);

-- Migrate existing text to IDs
UPDATE user_profiles up
SET department_id = d.id
FROM departments d
WHERE LOWER(TRIM(up.department)) = LOWER(TRIM(d.name));

-- Optional: Drop old column
ALTER TABLE user_profiles DROP COLUMN department;

-- Or keep both for backward compatibility
-- ALTER TABLE user_profiles ALTER COLUMN department DROP NOT NULL;
```

**Impact on Code:**
- Need to update API to use `department_id` instead of `department`
- Need to join with `departments` table to get name
- Better data integrity

---

### Issue #2: `roles` table missing `level` column

**Current:**
```sql
roles: id, name, description, created_at, updated_at, department_id
```

**Problem:** Your code references `roles.level` but it doesn't exist!

**Code Reference:**
```typescript
// In /app/api/admin/captain-log-entries/route.ts
WHERE r.level >= 4  -- Admin level and above
```

**Recommendation:**
```sql
-- Add level column
ALTER TABLE roles 
ADD COLUMN level INTEGER DEFAULT 1 NOT NULL;

-- Add check constraint
ALTER TABLE roles 
ADD CONSTRAINT roles_level_check 
CHECK (level >= 1 AND level <= 5);

-- Set levels for existing roles
UPDATE roles SET level = 5 WHERE name = 'super-admin';
UPDATE roles SET level = 4 WHERE name = 'admin';
UPDATE roles SET level = 3 WHERE name IN ('manager', 'quality-engineer');
UPDATE roles SET level = 2 WHERE name IN ('user', 'developer', 'designer');
UPDATE roles SET level = 1 WHERE name = 'viewer';

-- Create index
CREATE INDEX idx_roles_level ON roles(level);
```

---

### Issue #3: `captain_log_entries` missing FK to `auth.users`

**Current:**
```sql
user_id uuid NOT NULL  -- No FK constraint!
```

**Recommendation:**
```sql
ALTER TABLE captain_log_entries 
ADD CONSTRAINT captain_log_entries_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;
```

**Benefit:** Database enforces that `user_id` must be a valid user

---

### Issue #4: Orphaned tables still in `all.sql`

**Current:** `all.sql` still contains definitions for deleted tables

**Recommendation:** Update `all.sql` to remove:
- `reports`
- `report_answers`
- `report_questions`
- `department_questions`
- `admins`

---

## 📋 **Recommended Schema Changes**

### Priority 1: Critical (Fix Now)

```sql
-- 1. Add level to roles table
ALTER TABLE roles ADD COLUMN level INTEGER DEFAULT 1 NOT NULL;
ALTER TABLE roles ADD CONSTRAINT roles_level_check CHECK (level >= 1 AND level <= 5);

UPDATE roles SET level = 5 WHERE name = 'super-admin';
UPDATE roles SET level = 4 WHERE name = 'admin';
UPDATE roles SET level = 3 WHERE name IN ('manager', 'quality-engineer');
UPDATE roles SET level = 2 WHERE name IN ('user', 'developer', 'designer');
UPDATE roles SET level = 1 WHERE name = 'viewer';

CREATE INDEX idx_roles_level ON roles(level);
```

### Priority 2: Important (Fix Soon)

```sql
-- 2. Add FK constraint to captain_log_entries
ALTER TABLE captain_log_entries 
ADD CONSTRAINT captain_log_entries_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. Change user_profiles.department to department_id (BREAKING CHANGE!)
ALTER TABLE user_profiles ADD COLUMN department_id UUID REFERENCES departments(id);

-- Migrate data
UPDATE user_profiles up
SET department_id = d.id
FROM departments d
WHERE LOWER(TRIM(up.department)) = LOWER(TRIM(d.name));

-- After verifying migration, drop old column
-- ALTER TABLE user_profiles DROP COLUMN department;
```

### Priority 3: Nice to Have

```sql
-- 4. Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_role_id ON user_profiles(role_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_active ON user_profiles(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_custom_responses_question_key ON custom_responses(question_key);

-- 5. Add composite index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_role_dept 
ON user_profiles(role_id, department_id) WHERE is_active = true;
```

---

## 📄 **Updated all.sql File**

I'll create a cleaned version with:
- ✅ Removed deleted tables
- ✅ Added `level` to `roles`
- ✅ Added FK to `captain_log_entries`
- ✅ Optional: Added `department_id` to `user_profiles`

Should I create this updated file?

---

## 🎯 **Summary**

### Current State:
- ✅ 8 core tables (clean and working)
- ❌ 5 deleted tables still in `all.sql`
- ⚠️ `roles.level` missing (code expects it)
- ⚠️ `user_profiles.department` is TEXT (should be FK)

### Recommended Actions:

1. **Immediate (Required):**
   - Add `level` column to `roles` table
   - Update `all.sql` to remove deleted tables

2. **Soon (Important):**
   - Add FK constraint to `captain_log_entries.user_id`
   - Migrate `user_profiles.department` → `department_id`

3. **Later (Nice to Have):**
   - Add performance indexes
   - Implement audit logging
   - Use permissions table for access control

---

**Would you like me to:**
1. Create SQL scripts for these changes?
2. Update `all.sql` with clean schema?
3. Update code to use `department_id` instead of `department`?
4. Add `roles.level` migration script?

Let me know which changes you want to implement!
