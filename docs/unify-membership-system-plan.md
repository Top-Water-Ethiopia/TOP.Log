# Unify Department Membership System

Merge `user_department_professions` and `user_department_access_levels` into a single `user_department_memberships` table with unified role management, eliminating string-hack role prefixes and creating a consistent lifecycle for all membership types.

## Phase 1: Database Schema Migration

### 1.1 Create Unified Membership Table

**New table:** `user_department_memberships`

```sql
CREATE TABLE user_department_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  membership_type membership_type_enum NOT NULL,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  last_used_at TIMESTAMPTZ, -- for fallback context selection
  deactivated_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- Note: Multiple memberships per department allowed (profession + access_level)
);

-- Indexes
CREATE INDEX idx_udp_memberships_user ON user_department_memberships(user_id);
CREATE INDEX idx_udp_memberships_dept ON user_department_memberships(department_id);
CREATE INDEX idx_udp_memberships_active ON user_department_memberships(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_udp_memberships_type ON user_department_memberships(membership_type);
CREATE INDEX idx_udp_memberships_user_dept ON user_department_memberships(user_id, department_id);
-- Prevent duplicate active memberships (same user+dept+type+role)
CREATE UNIQUE INDEX idx_no_duplicate_memberships
ON user_department_memberships(user_id, department_id, membership_type, role_id)
WHERE is_active = TRUE;
-- One primary membership GLOBALLY per user (defines login context)
CREATE UNIQUE INDEX idx_one_primary_per_user
ON user_department_memberships(user_id) WHERE is_primary = TRUE AND is_active = TRUE;
-- CHECK constraints (enforced at DB level, not just uniqueness)
ALTER TABLE user_department_memberships
ADD CONSTRAINT chk_primary_must_be_profession
CHECK (is_primary = FALSE OR membership_type = 'profession');

ALTER TABLE user_department_memberships
ADD CONSTRAINT chk_primary_must_be_active
CHECK (is_primary = FALSE OR is_active = TRUE);

-- Trigger: On primary membership deactivation, auto-promote fallback
CREATE OR REPLACE FUNCTION handle_primary_deactivation()
RETURNS TRIGGER AS $$
DECLARE
  v_fallback_id UUID;
BEGIN
  IF OLD.is_primary = TRUE AND NEW.is_active = FALSE THEN
    -- Find fallback profession membership
    SELECT id INTO v_fallback_id
    FROM user_department_memberships
    WHERE user_id = NEW.user_id
      AND is_active = TRUE
      AND membership_type = 'profession'
      AND id != NEW.id
    ORDER BY is_primary DESC, last_used_at DESC NULLS LAST, created_at DESC
    LIMIT 1;

    IF v_fallback_id IS NOT NULL THEN
      UPDATE user_department_memberships
      SET is_primary = TRUE,
          updated_at = NOW()
      WHERE id = v_fallback_id
        AND is_primary = FALSE;

      -- Log the auto-promotion
      INSERT INTO membership_audit_log (
        user_id, from_dept, to_dept, membership_type, role_id,
        action, reason, performed_by
      ) VALUES (
        NEW.user_id, NULL, NULL, NEW.membership_type, NEW.role_id,
        'primary_auto_promoted',
        'Previous primary was deactivated',
        COALESCE(NEW.updated_by, auth.uid())
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_handle_primary_deactivation
AFTER UPDATE ON user_department_memberships
FOR EACH ROW
WHEN (OLD.is_active = TRUE AND NEW.is_active = FALSE)
EXECUTE FUNCTION handle_primary_deactivation();

-- Trigger: Update last_used_at on activity
CREATE OR REPLACE FUNCTION update_last_used()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_used_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_last_used
BEFORE UPDATE ON user_department_memberships
FOR EACH ROW
WHEN (NEW.is_active = TRUE AND OLD.is_active = TRUE)
EXECUTE FUNCTION update_last_used();

-- Alternative: API-controlled last_used_at
-- For more precise tracking, update via API layer instead:
-- await supabase.rpc('touch_membership', { p_membership_id: id });

-- RLS
ALTER TABLE user_department_memberships ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "memberships_select_own"
ON user_department_memberships FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "memberships_select_admin"
ON user_department_memberships FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));
-- Note: is_admin(auth.uid()) checks:
-- 1. user_profiles.is_admin = TRUE, OR
-- 2. User has system-level admin role in user_system_roles table

CREATE POLICY "memberships_insert_admin"
ON user_department_memberships FOR INSERT
TO authenticated
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "memberships_update_admin"
ON user_department_memberships FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()));

CREATE POLICY "memberships_delete_admin"
ON user_department_memberships FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));

-- Foreign key constraint (enforced at DB level)
ALTER TABLE user_department_memberships
ADD CONSTRAINT fk_membership_role
FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT;

-- Validation trigger: membership_type must match role.type
CREATE OR REPLACE FUNCTION validate_membership_role_type()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM roles
    WHERE id = NEW.role_id
      AND type = NEW.membership_type
  ) THEN
    RAISE EXCEPTION 'Role type mismatch: role.type does not match membership.membership_type';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_membership_role
BEFORE INSERT OR UPDATE ON user_department_memberships
FOR EACH ROW EXECUTE FUNCTION validate_membership_role_type();
```

### 1.2 Create Unified Roles Table

**New table:** `roles` (replaces department_professions + department_access_levels)

```sql
-- Create ENUM types first
CREATE TYPE membership_type_enum AS ENUM ('profession', 'access_level');
CREATE TYPE role_type_enum AS ENUM ('profession', 'access_level');
CREATE TYPE role_scope_enum AS ENUM ('department', 'system');

CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type role_type_enum NOT NULL,
  scope role_scope_enum NOT NULL,
  name TEXT NOT NULL, -- e.g., "developer", "department-lead"
  display_name TEXT NOT NULL, -- e.g., "Developer", "Department Lead"
  description TEXT,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE, -- NULL for system-wide roles
  level INTEGER CHECK (level BETWEEN 1 AND 10), -- For access levels (1-10), NULL for professions
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(type, scope, department_id, name)
);

-- Indexes
CREATE INDEX idx_roles_type ON roles(type);
CREATE INDEX idx_roles_dept ON roles(department_id) WHERE department_id IS NOT NULL;
CREATE INDEX idx_roles_active ON roles(is_active) WHERE is_active = TRUE;
```

### 1.3 Create Role Permissions Table

```sql
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  effect TEXT NOT NULL DEFAULT 'allow' CHECK (effect IN ('allow', 'deny')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(role_id, resource, action)
);

CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);
```

### 1.4 Create Audit Log Table

```sql
CREATE TABLE membership_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  to_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  membership_type membership_type_enum,
  role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('moved', 'activated', 'deactivated', 'created', 'primary_assigned', 'primary_removed', 'primary_auto_promoted')),
  reason TEXT,
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB, -- extensible context (IP, user agent, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user ON membership_audit_log(user_id);
CREATE INDEX idx_audit_log_created ON membership_audit_log(created_at);
```

### 1.5 Migrate Existing Data

```sql
-- Step 1: Insert access levels as roles
INSERT INTO roles (type, scope, name, display_name, description, level)
SELECT
  'access_level' as type,
  'system' as scope,
  name,
  display_name,
  description,
  level
FROM department_access_levels
WHERE is_active = TRUE;

-- Step 2: Insert department professions as roles
INSERT INTO roles (type, scope, department_id, name, display_name, is_active, is_default)
SELECT
  'profession' as type,
  'department' as scope,
  department_id,
  key as name,
  label as display_name,
  is_active,
  is_default
FROM department_professions
ON CONFLICT (type, scope, department_id, name) DO NOTHING;

-- Step 3: Migrate access level memberships
INSERT INTO user_department_memberships (
  user_id, department_id, membership_type, role_id,
  is_active, is_primary, created_at, updated_at
)
SELECT
  udal.user_id,
  udal.department_id,
  'access_level' as membership_type,
  r.id as role_id,
  TRUE as is_active, -- access levels don't have is_active
  FALSE as is_primary,
  udal.created_at,
  udal.updated_at
FROM user_department_access_levels udal
JOIN department_access_levels dal ON udal.access_level_id = dal.id
JOIN roles r ON r.name = dal.name AND r.type = 'access_level' AND r.scope = 'system';

-- Step 4: Migrate profession memberships
INSERT INTO user_department_memberships (
  user_id, department_id, membership_type, role_id,
  is_active, is_primary, deactivated_at, created_at, updated_at
)
SELECT
  udp.user_id,
  udp.department_id,
  'profession' as membership_type,
  r.id as role_id,
  udp.is_active,
  udp.is_primary,
  udp.deactivated_at,
  udp.created_at,
  udp.updated_at
FROM user_department_professions udp
JOIN department_professions dp ON udp.role = dp.key AND udp.department_id = dp.department_id
JOIN roles r ON r.name = dp.key AND r.department_id = dp.department_id AND r.type = 'profession' AND r.scope = 'department';

-- Step 5: Migrate permissions
INSERT INTO role_permissions (role_id, resource, action)
SELECT
  r.id as role_id,
  dalp.resource,
  dalp.action
FROM department_access_level_permissions dalp
JOIN department_access_levels dal ON dalp.access_level_id = dal.id
JOIN roles r ON r.name = dal.name AND r.type = 'access_level';
```

## Phase 2: Update API Layer

### 2.1 Update GET `/api/admin/departments/{id}/memberships`

**Current:** Merges two tables with string-hack roles  
**New:** Single query with proper joins

```typescript
const { data: memberships, error } = await adminSupabase
  .from("user_department_memberships")
  .select(
    `
    id,
    user_id,
    department_id,
    membership_type,
    is_active,
    is_primary,
    created_at,
    updated_at,
    role:roles!inner(
      id,
      type,
      name,
      display_name,
      level
    )
  `,
  )
  .eq("department_id", departmentId)
  .order("updated_at", { ascending: false })
  .range(offset, offset + limit - 1);

// Response format with pagination:
{
  data: [...],
  total: 124,
  page: 1,
  limit: 50,
  totalPages: 3
}
```

### 2.2 Update Move Member Logic

**Critical rule:** Move must NEVER implicitly affect other memberships. Always scope by `membership_type` + `role_id`.

```sql
-- CORRECT: Only deactivate the specific membership being moved
UPDATE user_department_memberships
SET is_active = FALSE
WHERE user_id = p_user_id
  AND department_id = p_from_department_id
  AND membership_type = p_membership_type
  AND role_id = p_role_id
  AND is_active = TRUE;

-- Only deactivate conflicting membership in target (same type+role)
UPDATE user_department_memberships
SET is_active = FALSE
WHERE user_id = p_user_id
  AND department_id = p_to_department_id
  AND membership_type = p_membership_type
  AND role_id = p_role_id
  AND is_active = TRUE;

-- Create new membership (preserve is_primary status)
INSERT INTO user_department_memberships (
  user_id, department_id, membership_type, role_id,
  is_active, is_primary, -- inherit primary status from old membership
  created_by, updated_by
) VALUES (
  p_user_id, p_to_department_id, p_membership_type, p_role_id,
  TRUE, p_is_primary,  -- preserve primary status from old membership
  p_performed_by, p_performed_by
);

-- Log per-membership audit event
INSERT INTO membership_audit_log (
  user_id, from_dept, to_dept, membership_type, role_id, action, performed_by
) VALUES (
  p_user_id, p_from_department_id, p_to_department_id,
  p_membership_type, p_role_id, 'moved', p_performed_by
);
```

**Primary membership rules:**

- If moving a primary membership, the new membership inherits `is_primary = TRUE`
- Race condition protection: Use `updated_at` optimistic locking or wrap in transaction with `SELECT ... FOR UPDATE`

**Setting primary membership (atomic API pattern):**

````ts
// Atomic: clear old primary AND set new in single operation
await supabase.rpc("set_user_primary_membership", {
  p_user_id,
  p_membership_id: targetId,
});

// OR use single UPDATE with conditional logic:
await supabase
  .from("user_department_memberships")
  .update({
    is_primary: supabase.raw("(id = ?)", [targetId]),
    updated_at: new Date().toISOString(),
  })
  .eq("user_id", userId);

// Log the change
// Also log primary_removed when clearing old primary:
await logAuditEvent({ action: 'primary_removed', user_id: p_user_id, membership_type: membership.membership_type, role_id: membership.role_id, performed_by: admin_id });

await logAuditEvent({
  action: 'primary_assigned',
  user_id: p_user_id,
  membership_type: membership.membership_type,
  role_id: membership.role_id,
  performed_by: admin_id
});

**Frontend validation:**

```ts
// Validate membership_type matches role.type before saving
if (membership.membership_type !== role.type) {
  throw new Error(
    "Role type mismatch: cannot assign access_level role to profession membership",
  );
}

// Validate role scope is compatible
// - System roles can be assigned to any department
// - Department roles must match membership.department_id
if (
  role.scope === "department" &&
  role.department_id !== membership.department_id
) {
  throw new Error(
    "Role department mismatch: department-specific role cannot be assigned to different department",
  );
}
// System scope is always valid

// Optional: limit memberships per department
const count = await countActiveMemberships(user_id, department_id);
if (count >= 5) {
  throw new Error("Maximum 5 roles per department");
}
````

### 2.3 Login Context Query (Primary Membership)

**Fallback query for user login:**

```sql
-- Get user's primary context, or fallback to most recently used
SELECT *
FROM user_department_memberships
WHERE user_id = ?
  AND is_active = TRUE
ORDER BY is_primary DESC, last_used_at DESC NULLS LAST
LIMIT 1;
```

**No-primary scenario handling:**

```ts
// If user has no primary membership
if (!primaryMembership) {
  if (memberships.length === 1) {
    // Auto-promote the only membership to primary
    await setPrimaryMembership(user_id, memberships[0].id);
  } else if (memberships.length > 1) {
    // Show "Choose your default workspace" modal
    showWorkspaceSelectionModal(memberships);
  } else {
    // No memberships at all - show onboarding
    redirectToOnboarding();
  }
}

// Cache primary context in session on login
session.primaryMembership = {
  department_id: primaryMembership.department_id,
  role_id: primaryMembership.role_id,
  membership_type: primaryMembership.membership_type,
};
```

### 2.4 Add Pagination

```typescript
// Add query params: ?page=1&limit=50
const page = parseInt(searchParams.get("page") || "1");
const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
const offset =
  (page - 1) *
  limit

    // Add to query with total count
    .select(..., { count: "exact" })
    .range(offset, offset + limit - 1);

// Response includes pagination metadata
const { data, count } = await query;
return {
  data,
  total: count,
  page,
  limit,
  totalPages: Math.ceil(count / limit)
};
```

## Phase 3: Update Frontend

### 3.1 Update Membership Types

```typescript
// lib/memberships/types.ts
interface Membership {
  id: string;
  user_id: string;
  department_id: string;
  membership_type: "profession" | "access_level";
  is_active: boolean;
  is_primary: boolean;
  role: {
    id: string;
    type: "profession" | "access_level";
    name: string;
    display_name: string;
    level?: number;
  };
  user: {
    user_id: string;
    name: string | null;
    email: string | null;
  };
}
```

### 3.2 Update UI Rendering

```typescript
// Render membership type badge
const getMembershipBadge = (membership: Membership) => {
  if (membership.membership_type === "access_level") {
    return <Badge variant="authority">{membership.role.display_name}</Badge>
  }
  return <Badge variant="role">{membership.role.display_name}</Badge>
}

// Render without string parsing
// No more `role.startsWith("access-level:")`
```

### 3.3 Update Move Dialog

**Current:** Only shows profession roles  
**New:** Allow choosing membership type and role

- Add radio: "Assign as profession" vs "Assign as department lead"
- Role dropdown filters by selected type
- Clear role selection when type changes

## Phase 4: Create Database Functions

### 4.1 Update `move_member_atomic()`

```sql
CREATE OR REPLACE FUNCTION move_member_atomic(
  p_user_id UUID,
  p_from_department_id UUID,
  p_to_department_id UUID,
  p_membership_type TEXT,
  p_role_id UUID,
  p_performed_by UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- 1. Deactivate SPECIFIC membership in source (scoped by type+role)
  UPDATE user_department_memberships
  SET is_active = FALSE,
      deactivated_at = NOW(),
      updated_at = NOW(),
      updated_by = p_performed_by
  WHERE user_id = p_user_id
    AND department_id = p_from_department_id
    AND membership_type = p_membership_type
    AND role_id = p_role_id
    AND is_active = TRUE;

  -- 2. Deactivate conflicting membership in target (same type+role)
  UPDATE user_department_memberships
  SET is_active = FALSE,
      deactivated_at = NOW(),
      updated_at = NOW(),
      updated_by = p_performed_by
  WHERE user_id = p_user_id
    AND department_id = p_to_department_id
    AND membership_type = p_membership_type
    AND role_id = p_role_id
    AND is_active = TRUE;

  -- 3. Insert new membership (preserve primary status)
  INSERT INTO user_department_memberships (
    user_id, department_id, membership_type, role_id,
    is_active, is_primary, created_by, updated_by
  ) VALUES (
    p_user_id, p_to_department_id, p_membership_type, p_role_id,
    TRUE, p_is_primary, p_performed_by, p_performed_by
  );

  -- 4. Log per-membership audit event
  INSERT INTO membership_audit_log (
    user_id, from_dept, to_dept, membership_type, role_id, reason, performed_by
  ) VALUES (
    p_user_id, p_from_department_id, p_to_department_id,
    p_membership_type, p_role_id, p_reason, p_performed_by
  );

  RETURN jsonb_build_object('success', TRUE);
END;
$$;
```

### 4.2 Role Deactivation Behavior (Final Decision: Option A Safe)

When `roles.is_active = FALSE`:

**Implementation: Option A (Safe)**

- Block NEW assignments to this role
- Existing memberships remain active (no cascade deactivation)
- UI shows "(deprecated)" badge on role display

**Rationale:** Preserves history, avoids cascading surprises, aligns with soft-delete philosophy

**Not implementing Option B (Strict)** to avoid unintended side effects on active users.

```sql
-- NOTE: Option B (Strict) - NOT USED. Included for reference only.
-- We chose Option A (Safe) which blocks new assignments but preserves existing.
-- If implementing Option B later, enable this trigger:

/*
CREATE OR REPLACE FUNCTION deactivate_role_memberships()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = FALSE AND OLD.is_active = TRUE THEN
    UPDATE user_department_memberships
    SET is_active = FALSE,
        deactivated_at = NOW(),
        updated_at = NOW()
    WHERE role_id = NEW.id
      AND is_active = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_role_deactivation
  AFTER UPDATE ON roles
  FOR EACH ROW
  EXECUTE FUNCTION deactivate_role_memberships();
*/
```

**Decision:** Use Option A (Safe). Option B code is commented out for future reference only.

## Phase 5: Migration Strategy (Clean Cut)

### 5.1 Create New Tables

Run Phase 1.1–1.3 SQL to create `roles`, `user_department_memberships`, `role_permissions`.

### 5.2 Migrate Data

Run Phase 1.4 migration scripts to populate new tables from existing data.

### 5.3 Update Application Code

- Switch API endpoints to read from `user_department_memberships`
- Update frontend to use new types
- Deploy application changes

### 5.4 Remove Old Tables

```sql
-- After confirming migration success
DROP TABLE IF EXISTS user_department_access_levels CASCADE;
DROP TABLE IF EXISTS user_department_professions CASCADE;
DROP TABLE IF EXISTS department_access_level_permissions CASCADE;
DROP TABLE IF EXISTS department_access_levels CASCADE;
DROP TABLE IF EXISTS department_professions CASCADE;
```

## Migration Checklist

- [ ] Create new tables (roles, user_department_memberships, role_permissions)
- [ ] Run data migration scripts
- [ ] Update API endpoints to use new schema
- [ ] Update frontend components
- [ ] Add new RPC functions
- [ ] Test move/deactivate/activate flows
- [ ] Verify audit logs capture all actions
- [ ] Drop old tables (after confirmation)

## Success Criteria

1. ✅ Single membership table (no dual systems)
2. ✅ No string-hack role prefixes
3. ✅ Consistent `is_active` lifecycle for all memberships
4. ✅ Move operation handles all membership types
5. ✅ Clean audit trail with no gaps
6. ✅ Paginated API responses
7. ✅ Type-safe frontend with no `any` types
