# User Journey: Testing Unified Membership System

## Pre-requisites
1. Database migrations applied (`npx supabase db push`)
2. Supabase types regenerated (`npx supabase gen types`)
3. Server restarted

---

## Journey 1: View Unified Members List

**Goal:** Verify both profession and access-level memberships appear in one list

### Steps:
1. **Login** → Navigate to `/admin/departments`
2. **Click any department** (e.g., "Engineering")
3. **Click "Members" tab**
4. **Verify list shows:**
   - Profession members (e.g., "Developer", "Designer") with 🔵 gray badge
   - Access level members (e.g., "Department Lead") with 🟣 blue badge
   - Primary membership shows ⭐ badge
   - Inactive members show "Inactive" badge

### Expected:
- No separate tabs for "Professions" vs "Access Levels"
- All memberships in single unified list
- Each row shows: Name, Email, Role, Status

---

## Journey 2: Create New Membership

**Goal:** Create a profession membership for a user

### Steps:
1. **On Members page** → Click "Assign member" button
2. **Search for user** → Type email/name in search box
3. **Select user** from dropdown
4. **Select role** → Choose "Developer" (or any profession)
5. **Toggle Active** → Keep "Active" enabled
6. **Click "Save"**
7. **Verify:**
   - New member appears in list
   - Badge shows "Developer"
   - Status is "Active"
   - ⭐ appears if it's their only membership (auto-primary)

### API Call Test:
```bash
POST /api/admin/departments/{id}/memberships
{
  "user_id": "uuid",
  "role_id": "developer-role-uuid",
  "membership_type": "profession",
  "is_active": true
}
```

---

## Journey 3: Move Member Between Departments

**Goal:** Move a member from Department A to Department B

### Steps:
1. **On Members page** → Find existing member (e.g., "John Doe")
2. **Click three-dots menu** → Select "Move to department"
3. **Select target department** from dropdown
4. **Select new role** (e.g., "Marketer" for Marketing dept)
5. **Add reason** (optional) → "Reassigned to marketing team"
6. **Click "Move"**
7. **Verify:**
   - Member disappears from source department
   - Member appears in target department
   - Role updated to new role
   - Primary status preserved (if was primary)

### Check Audit Log:
8. **Click "View history"** on the moved member
9. **Verify** action "moved" appears with:
   - From department
   - To department  
   - Reason
   - Performed by

---

## Journey 4: Deactivate and Reactivate

**Goal:** Test soft delete (deactivate) and reactivation

### Deactivate:
1. **On Members page** → Find active member
2. **Click three-dots** → "Deactivate"
3. **Add reason** → "On leave"
4. **Confirm**
5. **Verify:**
   - Member shows "Inactive" badge
   - Member still visible in list (not removed)

### Reactivate:
6. **Click three-dots** → "Activate"
7. **Verify:**
   - "Active" badge restored

---

## Journey 5: Test Primary Membership

**Goal:** Verify primary membership logic and fallback

### Steps:
1. **Create user with multiple memberships:**
   - Add to Engineering as Developer (primary)
   - Add to Marketing as Viewer (non-primary)
2. **Verify Engineering shows ⭐ Primary badge**
3. **Deactivate Engineering membership**
4. **Verify:**
   - Marketing membership auto-promotes to primary (⭐ appears)
   - Audit log shows "primary_auto_promoted" action
5. **Reactivate Engineering membership**
6. **Manually set Engineering as primary** via edit dialog

---

## Journey 6: Test Access Level Membership

**Goal:** Create department lead (access_level) membership

### Steps:
1. **Go to department** → Click "Assign member"
2. **Select user** → Search and choose
3. **Select role type** → Choose "access_level" (Department Lead)
4. **Save**
5. **Verify:**
   - Member shows with 🟣 "Department Lead" badge
   - Cannot be set as primary (CHECK constraint)

---

## Journey 7: Role Validation

**Goal:** Verify role/membership type matching

### Test Error Case:
1. **Try to assign profession role to access_level membership** (via API)
```bash
POST /api/admin/departments/{id}/memberships
{
  "user_id": "uuid",
  "role_id": "developer-role-uuid",  // profession role
  "membership_type": "access_level"   // mismatch!
}
```
2. **Expect 400 error:** "Role type mismatch"

---

## Journey 8: Duplicate Prevention

**Goal:** Verify cannot create duplicate memberships

### Steps:
1. **Create membership:** User A + Dept A + Developer role
2. **Try to create same again**
3. **Expect:** Update existing (activate if inactive) instead of duplicate

---

## Error Scenarios to Test

| Scenario | Expected Behavior |
|----------|-------------------|
| Move to same department | Error: "Source and target are the same" |
| Concurrent edit (optimistic lock) | Error: "Record modified by another user" |
| Invalid role ID | Error: "Invalid role" |
| Missing user_id | Error: "user_id is required" |
| Missing role_id | Error: "role_id is required" |

---

## Post-Test Verification

### Database Checks:
```sql
-- Verify new tables exist
SELECT * FROM roles LIMIT 1;
SELECT * FROM user_department_memberships LIMIT 1;
SELECT * FROM membership_audit_log LIMIT 1;

-- Verify data migrated
SELECT COUNT(*) FROM user_department_memberships;
SELECT COUNT(*) FROM user_department_professions; -- Should still have old data

-- Verify audit logs created
SELECT action, COUNT(*) FROM membership_audit_log GROUP BY action;
```

### Cleanup (After Confirmation):
```sql
-- Only after full testing:
DROP TABLE user_department_professions;
DROP TABLE user_department_access_levels;
DROP TABLE department_professions;
DROP TABLE department_access_levels;
```

---

## Summary Checklist

- [ ] Unified members list displays correctly
- [ ] Create profession membership works
- [ ] Create access_level membership works
- [ ] Move member between departments works
- [ ] Primary membership auto-promotion works
- [ ] Deactivate/activate works (soft delete)
- [ ] Audit logs capture all actions
- [ ] Role type validation prevents mismatches
- [ ] Duplicate prevention works
- [ ] Optimistic locking prevents conflicts
