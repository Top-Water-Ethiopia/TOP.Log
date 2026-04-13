# Department Members List - Implementation Document

## Overview

The department members list displays users assigned to a department through two different assignment systems:

1. **Profession-based memberships** (`user_department_professions`) - Traditional role assignments
2. **Access-level-based memberships** (`user_department_access_levels`) - Department leads with permission levels

## Data Architecture

### Database Tables

```
user_department_professions          user_department_access_levels
├── id (UUID PK)                      ├── id (UUID PK)
├── user_id (UUID FK)                 ├── user_id (UUID FK)
├── department_id (UUID FK)           ├── department_id (UUID FK)
├── role (TEXT)                       ├── access_level_id (UUID FK)
├── is_active (BOOLEAN)               ├── assigned_by (UUID FK)
├── is_primary (BOOLEAN)              ├── created_at
├── created_at                        └── updated_at
└── updated_at

department_professions               department_access_levels
├── key (TEXT PK)                     ├── id (UUID PK)
├── label (TEXT)                      ├── name (TEXT)
├── department_id (UUID FK)             ├── display_name (TEXT)
└── is_active (BOOLEAN)               └── level (INTEGER)
```

## API Implementation

### GET `/api/admin/departments/{departmentId}/memberships`

**Location:** `app/api/admin/departments/[departmentId]/memberships/route.ts`

**Data Fetching:**

```typescript
// 1. Fetch profession-based memberships
const { data: professions } = await adminSupabase
  .from("user_department_professions")
  .select("id, user_id, department_id, role, is_active, created_at, updated_at")
  .eq("department_id", departmentId)

// 2. Fetch access-level-based memberships (department leads)
const { data: accessLevels } = await adminSupabase
  .from("user_department_access_levels")
  .select(`
    id,
    user_id,
    department_id,
    access_level:department_access_levels!inner(name, display_name),
    created_at,
    updated_at
  `)
  .eq("department_id", departmentId)

// 3. Transform access levels to membership format
const accessLevelMemberships = accessLevels.map((a) => ({
  id: a.id,
  user_id: a.user_id,
  department_id: a.department_id,
  role: `access-level:${a.access_level?.name}`,
  is_active: true,
  is_access_level: true,
  access_level_name: a.access_level?.name,
  access_level_display_name: a.access_level?.display_name,
}))

// 4. Merge both types
const memberships = [...professions, ...accessLevelMemberships]
```

**Response Format:**

```json
{
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "department_id": "uuid",
      "role": "developer",           // or "access-level:department-lead"
      "is_active": true,
      "is_access_level": false,        // true for access-level members
      "access_level_name": null,       // set for access-level members
      "access_level_display_name": null,
      "user": {
        "user_id": "uuid",
        "name": "John Doe",
        "email": "john@example.com"
      }
    }
  ]
}
```

## Frontend Implementation

### Location
`app/admin/departments/[departmentId]/members/page.tsx`

### Key Components

#### Data Fetching

```typescript
const membershipsKey = canAccessAdmin && departmentId
  ? `/api/admin/departments/${departmentId}/memberships`
  : null

const { data: membershipsResponse, mutate: mutateMemberships } = useSWR(membershipsKey)

const memberships = useMemo(() => {
  return Array.isArray(membershipsResponse?.data)
    ? membershipsResponse?.data ?? []
    : []
}, [membershipsResponse])
```

#### Member Actions

| Action | Handler | Description |
|--------|---------|-------------|
| Deactivate | `deactivateMember()` | Soft-delete (sets `is_active: false`) |
| Activate | `activateMember()` | Reactivate membership |
| Move | `moveMember()` | Transfer to another department |
| Set Primary | `setMemberAsPrimary()` | Mark as primary department |
| Hard Delete | `removeMemberHard()` | Permanent deletion with audit log |
| View History | `fetchHistory()` | Show membership audit trail |

#### Move Member Feature

**State Management:**

```typescript
const [memberToMove, setMemberToMove] = useState<MembershipRow | null>(null)
const [moveTargetDepartmentId, setMoveTargetDepartmentId] = useState("")
const [moveNewRole, setMoveNewRole] = useState("")
const [targetDeptRoles, setTargetDeptRoles] = useState<DepartmentRoleRow[]>([])
```

**Department Fetching:**

```typescript
// Fetch ALL departments (not just user's)
useEffect(() => {
  if (!memberToMove) return
  const response = await apiFetch("/api/departments")
  // Transform from membership format to { id, name }
  const departments = response.data.map((m) => ({
    id: m.department_id,
    name: m.department?.name || "Unnamed Department",
  }))
  setAllDepartments(departments)
}, [memberToMove])
```

**Role Fetching (Target Department):**

```typescript
useEffect(() => {
  if (!moveTargetDepartmentId) return
  const response = await apiFetch(
    `/api/admin/departments/${moveTargetDepartmentId}/profession-roles`
  )
  setTargetDeptRoles(response.data.filter((r) => r.is_active))
}, [moveTargetDepartmentId])
```

**Move API Call:**

```typescript
await apiFetch(`/api/admin/departments/${departmentId}/memberships`, {
  method: "POST",
  body: JSON.stringify({
    action: "move",
    user_id: memberToMove.user_id,
    target_department_id: moveTargetDepartmentId,
    new_role: moveNewRole,
    reason: moveReason,
    last_updated_at: memberToMove.updated_at, // Optimistic locking
  }),
})
```

## Database RPC Functions

### `move_member_atomic()`

**Location:** Supabase migration (20251231120000)

Handles atomic member move:
1. Deactivate membership in source department
2. Deactivate any active membership in target department (for this user)
3. Create/activate membership in target department
4. Log audit events

## UI Features

### Member List Display

- **Name/Email**: From `user_profiles` + auth.users
- **Role**: Profession role OR access level (e.g., "department-lead")
- **Status**: Active/Inactive with visual indicator
- **Primary**: Star badge for primary department
- **Actions**: Menu with deactivate, move, history, delete

### Filtering

- Search by name/email
- Filter by status (active/inactive)
- Filter by role type

## Testing

**Test File:** `__tests__/move-member-departments.test.ts`

Covers:
- API response transformation
- Current department exclusion
- Edge cases (null data, missing names)

## Known Limitations

1. **Access level members** show as `access-level:{name}` in role column - may need UI formatting
2. **Move dialog** only shows profession roles, not access levels (by design - moves are to profession roles)
3. **History** only tracks profession membership events, not access level changes

## Future Improvements

- [ ] Format access level roles with badges (e.g., "Department Lead" badge)
- [ ] Allow moving members to access level roles
- [ ] Unified member type system (merge professions and access levels)
- [ ] Batch operations (multi-select, bulk move)
