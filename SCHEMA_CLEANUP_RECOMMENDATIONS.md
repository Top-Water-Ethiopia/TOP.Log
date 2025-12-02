# 🗂️ Database Schema Cleanup Recommendations

## Executive Summary

After analyzing your database schema (`all.sql`) and actual code usage, I found **significant redundancy and unused tables**. Your application has **TWO SEPARATE reporting systems** that are confusing and partially unused.

### Current State
- ✅ **16 auth users**, **12 user profiles**, **6 roles**, **2 departments**
- ✅ **1 captain log entry** with **3 custom responses** ← **ACTIVELY USED**
- ⚠️ **Multiple duplicate/unused tables**

---

## 🎯 **Tables Analysis: KEEP vs REMOVE**

### ✅ **CORE TABLES - KEEP (Actively Used)**

#### 1. **`user_profiles`** ✅ KEEP
**Status**: **ACTIVELY USED** throughout the app  
**Usage**: Authentication, RBAC, admin management  
**Dependencies**: Referenced by all features  
**Action**: **KEEP - NO CHANGES**

#### 2. **`roles`** ✅ KEEP
**Status**: **ACTIVELY USED**  
**Usage**: Role-based access control (6 roles defined)  
**Dependencies**: `user_profiles.role_id`, `role_questions.role_id`  
**Action**: **KEEP - NO CHANGES**

#### 3. **`departments`** ✅ KEEP
**Status**: **ACTIVELY USED**  
**Usage**: User department assignment (2 departments)  
**Dependencies**: `user_profiles.department_id`, `roles.department_id`  
**Action**: **KEEP - NO CHANGES**

#### 4. **`captain_log_entries`** ✅ KEEP
**Status**: **ACTIVELY USED** (Main Dashboard System)  
**Usage**: Stores daily log entries from main dashboard  
**Current Data**: 1 entry  
**Code Usage**:
- `app/api/admin/captain-log-entries/route.ts`
- `contexts/supabase-log-context.tsx`
- `components/admin-reports-view.tsx`  
**Action**: **KEEP - THIS IS YOUR PRIMARY SYSTEM**

#### 5. **`custom_responses`** ✅ KEEP
**Status**: **ACTIVELY USED** (Dynamic Questions System)  
**Usage**: Stores answers to role-specific questions  
**Current Data**: 3 responses  
**Dependencies**: `captain_log_entries.id`  
**Action**: **KEEP - CRITICAL FOR MAIN SYSTEM**

#### 6. **`role_questions`** ✅ KEEP
**Status**: **ACTIVELY USED**  
**Usage**: Defines role-specific questions for captain log  
**Code Usage**: `app/api/admin/role-questions/`  
**Action**: **KEEP - DEFINES QUESTIONS FOR custom_responses**

---

### ⚠️ **QUESTIONABLE TABLES - DECIDE**

#### 7. **`permissions`** ⚠️ REVIEW
**Status**: **TABLE EXISTS** but minimal usage  
**Schema**: Maps permissions to roles (role_id, resource, action, conditions)  
**Code Usage**: Types defined in `lib/supabase/index.ts`, but not heavily used  
**Decision Required**:
- ✅ **KEEP** if you plan to implement fine-grained permissions
- ❌ **REMOVE** if using simple role-based access (current state)  
**Recommendation**: **KEEP** for future-proofing (enterprise feature)

#### 8. **`audit_logs`** ⚠️ REVIEW
**Status**: **TABLE EXISTS** but minimal usage  
**Schema**: Tracks system operations (timestamp, operation, entity_id, changes, user_id)  
**Code Usage**: Types defined but not actively logging  
**Decision Required**:
- ✅ **KEEP** if you want audit trails (compliance, security)
- ❌ **REMOVE** if not needed  
**Recommendation**: **KEEP** (important for enterprise compliance)

---

### ❌ **DUPLICATE/UNUSED TABLES - REMOVE**

#### 9. **`reports`** ❌ **REMOVE**
**Status**: **DUPLICATE SYSTEM** (Alternative to `captain_log_entries`)  
**Schema**: Simple report storage (id, user_id, submitted_at)  
**Code Usage**: 
- `app/api/reports/route.ts` ← Separate API endpoint
- `components/report/ReportForm.tsx` ← Alternative form  
**Problem**: 
- This is a **SEPARATE reporting system** from captain_log_entries
- Data here does NOT show in `/admin/reports`
- Confusing for users and admins  
**Recommendation**: **❌ REMOVE** and migrate to captain_log_entries system

#### 10. **`report_answers`** ❌ **REMOVE**
**Status**: **DUPLICATE** (Alternative to `custom_responses`)  
**Schema**: Stores answers to report_questions  
**Dependencies**: Links to `reports` table  
**Problem**: Redundant with `custom_responses` table  
**Recommendation**: **❌ REMOVE** along with `reports`

#### 11. **`report_questions`** ❌ **REMOVE**
**Status**: **DUPLICATE** (Alternative to `role_questions`)  
**Schema**: Defines questions for reports  
**Problem**: Redundant with `role_questions` table  
**Code Usage**: Minimal, mostly in seed scripts  
**Recommendation**: **❌ REMOVE** along with `reports`

#### 12. **`department_questions`** ❌ **REMOVE**
**Status**: **UNUSED** and **REDUNDANT**  
**Schema**: Department-specific questions (similar to role_questions)  
**Code Usage**: **NOT FOUND in active code**  
**Problem**: 
- You already have `role_questions` which is more flexible
- No code actively uses this table
- Adds unnecessary complexity  
**Recommendation**: **❌ REMOVE** (Use role_questions instead)

#### 13. **`admins`** ❌ **REMOVE**
**Status**: **REDUNDANT**  
**Schema**: Simple admin user list (just user_id)  
**Code Usage**: **NOT FOUND in active code**  
**Problem**: 
- Admin status is determined by `user_profiles.role_id` (level >= 4)
- This table is not needed  
**Recommendation**: **❌ REMOVE** (Use roles.level instead)

---

## 📊 **Summary Table**

| Table | Status | Action | Reason |
|-------|--------|--------|--------|
| `user_profiles` | ✅ Active | **KEEP** | Core authentication & RBAC |
| `roles` | ✅ Active | **KEEP** | Role definitions |
| `departments` | ✅ Active | **KEEP** | Department organization |
| `captain_log_entries` | ✅ Active | **KEEP** | Main log system |
| `custom_responses` | ✅ Active | **KEEP** | Dynamic answers |
| `role_questions` | ✅ Active | **KEEP** | Question definitions |
| `permissions` | ⚠️ Defined | **KEEP** | Future enterprise feature |
| `audit_logs` | ⚠️ Defined | **KEEP** | Compliance & security |
| `reports` | ❌ Duplicate | **REMOVE** | Duplicate of captain_log |
| `report_answers` | ❌ Duplicate | **REMOVE** | Duplicate of custom_responses |
| `report_questions` | ❌ Duplicate | **REMOVE** | Duplicate of role_questions |
| `department_questions` | ❌ Unused | **REMOVE** | Not used anywhere |
| `admins` | ❌ Redundant | **REMOVE** | Use roles.level instead |

---

## 🔧 **Cleanup Actions**

### Phase 1: Backup & Analysis (DO FIRST)
```sql
-- Export all data before deletion
SELECT * FROM reports;
SELECT * FROM report_answers;
SELECT * FROM report_questions;
SELECT * FROM department_questions;
SELECT * FROM admins;
```

### Phase 2: Remove Duplicate Reporting System
```sql
-- Drop the alternative reporting tables
DROP TABLE IF EXISTS report_answers CASCADE;
DROP TABLE IF EXISTS report_questions CASCADE;
DROP TABLE IF EXISTS reports CASCADE;
```

### Phase 3: Remove Unused Tables
```sql
-- Drop unused tables
DROP TABLE IF EXISTS department_questions CASCADE;
DROP TABLE IF EXISTS admins CASCADE;
```

### Phase 4: Cleanup Code References
After dropping tables, remove these files:
- `app/api/reports/route.ts` (if exists)
- `components/report/ReportForm.tsx` (if separate from main system)
- Any imports/types related to deleted tables

---

## 🎯 **Recommended Final Schema**

### Core Tables (8 tables)
1. ✅ `auth.users` (Supabase built-in)
2. ✅ `user_profiles` (Extended user data)
3. ✅ `roles` (Role definitions)
4. ✅ `departments` (Department organization)
5. ✅ `captain_log_entries` (Main log entries)
6. ✅ `custom_responses` (Dynamic answers)
7. ✅ `role_questions` (Question definitions)
8. ✅ `permissions` (Fine-grained permissions)
9. ✅ `audit_logs` (System audit trail)

### Total: **9 tables** (down from 13)

---

## 🚨 **Important Notes**

### Data Migration Required
If you have any data in the `reports` system:
1. **Export** all reports, report_answers, report_questions
2. **Migrate** to captain_log_entries + custom_responses format
3. **Verify** migration success
4. **Then delete** old tables

### Code Updates Required
After dropping tables, update:
- Remove types from `lib/supabase/index.ts`
- Remove API routes for deleted tables
- Remove any UI components using deleted tables
- Update documentation

---

## 📝 **Migration Script**

I can create a comprehensive migration script that will:
1. ✅ Backup all data from tables to be removed
2. ✅ Migrate `reports` data to `captain_log_entries` format
3. ✅ Drop unused tables safely
4. ✅ Verify schema integrity

**Would you like me to create this migration script?**

---

## 🎉 **Benefits After Cleanup**

1. ✅ **Simpler Schema** - Easier to understand and maintain
2. ✅ **Single System** - No confusion between two reporting systems
3. ✅ **Better Performance** - Fewer tables to query
4. ✅ **Cleaner Codebase** - Remove unused code and types
5. ✅ **Easier Development** - Clear data flow and relationships
6. ✅ **Better Admin Experience** - All reports in one place

---

## 🤔 **Questions to Answer**

Before proceeding with cleanup, please confirm:

1. ❓ **Do you have any data in `reports`, `report_answers`, `report_questions` tables?**
   - If YES → Need migration script
   - If NO → Can delete immediately

2. ❓ **Is the `/report` page (ReportForm.tsx) still being used?**
   - If YES → Need to refactor to use captain_log system
   - If NO → Can delete the page

3. ❓ **Do you want to keep `department_questions` for future use?**
   - Currently unused, but might be useful later
   - Recommendation: Remove (use role_questions instead)

4. ❓ **Do you need `permissions` table for fine-grained access control?**
   - Currently using simple role-based access
   - Recommendation: Keep for future enterprise features

5. ❓ **Do you need `audit_logs` for compliance/security?**
   - Currently not actively logging
   - Recommendation: Keep and implement logging

---

## ✅ **Next Steps**

1. **Review this analysis** and confirm which tables to remove
2. **Check for data** in tables marked for removal
3. **I'll create migration scripts** based on your decisions
4. **Execute migration** in staging environment first
5. **Test thoroughly** before production cleanup
6. **Update code** to remove references to deleted tables

**Ready to proceed?** Let me know which tables you want to remove, and I'll create the complete cleanup and migration scripts!
