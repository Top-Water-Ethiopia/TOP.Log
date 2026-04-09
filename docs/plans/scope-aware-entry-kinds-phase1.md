# Scope-Aware Entry Kinds Configuration - Phase 1 (Revised)

Implement a configurable entry kind system allowing admins to define which system entry kinds (`standard`, `agent_call`, `daily_summary`) are available per reporting scope (department-wide or profession-specific), with dynamic tabs in the Role Questions Creator based on the selected scope.

## User Stories

### Core Epic

As an admin, I want to configure which system entry kinds are available for each reporting scope and use them as tabs in the Role Questions Creator, so department-wide and profession-specific reports can have the right question sets without hardcoded behavior.

### Story A — Configure entry kinds per scope

As an admin, I want to activate, order, label, and choose a default entry kind for a department-wide or profession-specific scope, so each scope only shows the report types relevant to that team.

### Story B — Use configured entry kinds in question creation

As an admin, I want the Role Questions Creator to render tabs from the selected scope's active entry kinds, so I can create questions directly under the correct report type.

### Story C — Preserve existing questions safely

As an admin, I want existing questions to remain visible and correctly classified even if scope configuration changes later, so I can manage legacy question sets without losing track of them.

### Story D — Keep current workflows working

As a product owner, I want existing hardcoded entry kinds and existing entries to continue working during rollout, so we can adopt scope-aware configuration without breaking reports or historical data.

### Story E — Self-healing missing config

As an admin, I want missing scope configuration to be automatically initialized with a sensible default, so I can keep working without manual database setup or confusing temporary fallbacks.

### Story F — Resolve deactivation blockers

As an admin, I want to see which questions are preventing an entry kind from being deactivated and have a path to fix them, so I can complete configuration changes without getting stuck.

### Story G — Keep draft questions separated by scope

As an admin, I want unsaved questions to remain attached to the scope where I created them, so switching between department and profession views does not mix drafts or cause accidental saves to the wrong context.

### Story H — Read config for submitter form rendering (Phase 1)

As a report submitter, I want the app to read the entry kind configuration for my reporting scope, so the system can render the correct form options (actual filtering implementation may be Phase 1 or later).

## Future Story — Submitter form filtering by entry kind

As a report submitter, I want only the questions for my selected entry kind to appear in the form, so I see only relevant questions for my report type.

## Critical Design Decisions

### 1. Unique Default Constraint (Corrected for Nullable Scope)

**Problem:** `UNIQUE(department_id, department_profession_id, is_default) WHERE is_default = true` fails with nullable `department_profession_id` because Postgres NULL behavior allows duplicates.

**Solution:** Two separate partial unique indexes:

```sql
-- Department scope: exactly one default per department
CREATE UNIQUE INDEX idx_scope_entry_kinds_dept_default
  ON public.scope_entry_kinds(department_id)
  WHERE department_profession_id IS NULL AND is_default = true;

-- Profession scope: exactly one default per profession
CREATE UNIQUE INDEX idx_scope_entry_kinds_prof_default
  ON public.scope_entry_kinds(department_profession_id)
  WHERE department_profession_id IS NOT NULL AND is_default = true;
```

### 2. Config Validity Rules (Explicit State Machine)

**Database constraints enforce:**

- At most one default per scope (via partial unique indexes)

**API layer enforces:**

- At least one entry kind must be active per scope
- Exactly one entry kind must be marked as default per scope
- The default entry kind must also be active (`is_default = true` AND `is_active = true`)

**States:**

- `NO_CONFIG`: No rows exist for scope → **self-healing**: create minimal default config (`standard` active, default)
- `INVALID`: Rows exist but violate rules above → show error, block creation until fixed
- `VALID`: Rows exist and satisfy rules → normal operation

### 3. Deactivation Rule (Hard Block with Remediation Path)

**Rule:** Cannot deactivate an entry kind if active questions exist for that scope.

**Validation:**

- Check `role_questions` for `department_id = X AND department_profession_id = Y AND entry_kind = Z AND is_active = true`
- If count > 0, return 400 error with details:
  - Message: "Cannot deactivate entry kind with N active questions. Reassign or archive questions first."
  - Include count of blocking questions
  - Include link/button to view those questions in manager

**UI remediation:**

- Show "View N questions" button in error state
- Link opens manager filtered to that entry kind
- After cleanup, allow deactivation

**Audit:** Deactivation attempts (blocked or successful) logged with admin user ID.

### 4. Scope Resolution (Explicit Precedence)

**Rule:** Profession scope **replaces** department scope, does not inherit.

**Resolution logic:**

1. If `department_profession_id` is selected → load profession scope config only
2. If only `department_id` selected → load department scope config only
3. No merging or fallback between scopes

### 5. Self-Healing Config Creation (Admin-Only, No Side Effects on Submitter Reads)

**Rule:** When admin-facing GET endpoint called for scope with no config rows, **persist** a minimal valid config immediately.

**Authorization boundary:**

- Admin/manager GET (`/api/admin/scope-entry-kinds`) → **may self-heal** (creates rows if missing)
- Submitter reads (future form rendering) → **read-only**, no row creation; fallback to default behavior without persistence

**Auto-created config (admin GET only):**

- `standard` entry kind only
- `is_active = true`
- `is_default = true`
- `sort_order = 0`
- Default label: "Standard"
- Default color: gray (#6B7280)
- Default icon: FileText
- `created_by` / `updated_by`: set to requesting admin user ID (audit trail)

**Concurrency handling:** If two admins simultaneously trigger self-healing for same scope:

1. First write succeeds
2. Second write hits unique conflict → catches error, re-reads existing config, returns that
3. Both admins receive valid config (one created it, one received existing)

**Why persist:** Ensures system converges to valid config, avoids repeated fallback logic, provides clear upgrade path from unconfigured to configured state.

**Telemetry:** Log self-healing event for monitoring ("created default config for scope X").

**Note on GET causing writes:** This is an intentional self-healing exception for admin surfaces, not ordinary REST behavior. Alternative (separate initialize endpoint) rejected for simplicity.

### 6. Seeding Strategy (Limited)

**Seed department scopes eagerly (migration):**

- All departments get `standard` (active, default)
- `agent_call` only if department already has questions with `entry_kind = 'agent_call'`
- `daily_summary` only if department already has questions with `entry_kind = 'daily_summary'`
- Default colors from system presets

**Seed profession scopes lazily:**

- Only seed when profession-scope questions first created, OR
- On first access to creator with that profession selected (create default config on-demand)

### 7. Manager Behavior (Show Existing Regardless of Config)

**Manager label resolution by question scope:**

- Department-scoped question → lookup department scope config
- Profession-scoped question → lookup profession scope config
- If config missing → fallback to system label ("Standard", "Agent Call", "Daily Summary")
- If config `is_active = false` → append " (Inactive)" to label

**Inactive entry kind handling:**

- Show section with "(Inactive)" badge
- Gray/dimmed styling
- Still editable/duplicateable
- Config change does not hide questions

### 8. Custom Labels (Presentation-Only with UX Guardrails)

**Rule:** `label` column is UI-only and must not imply different system behavior.

**Validation:** Labels can be any text, but underlying `entry_kind` key drives all system logic.

**UX protection:**

- Show system key (`standard`, `agent_call`, `daily_summary`) under/behind editable label
- Add helper text explaining behavior tied to each key:
  - `agent_call`: "Used for agent-linked reports with assigned agent dropdown"
  - `daily_summary`: "Used for once-per-day summary reports"
  - `standard`: "Default report type for general entries"

### 9. Access Control (Explicit, Submitter-Facing)

**RLS Policies:**

- SELECT: authenticated users (both admins AND report submitters need to read config for form rendering)
- INSERT/UPDATE/DELETE: users with `admin` role or `departments.manage` permission

**API routes:** Use existing admin permission checks from `/api/admin/*` pattern for mutations.

**User story tie-in:**

- Admins configure (Story A)
- Submitters read config to render correct forms (Story H)

### 10. Scope Switching in Creator (Scope-Partitioned Drafts, Ephemeral)

**Draft storage model:**

- Unsaved questions stored in **in-memory state only** (ephemeral, page session scoped)
- Partitioned by scope key: `{departmentId}|{professionId || 'dept'}`
- Each scope has its own draft array independent of others
- **Cleared after successful save** for that scope
- **Discarded on page unload** (no localStorage persistence in Phase 1)

**When scope changes (dept ↔ profession):**

1. Save current scope's unsaved questions to its partition in state
2. Reload tabs from new scope's config
3. Load new scope's draft questions from its partition (if any)
4. If current `activeEntryKindTab` exists in new scope → keep it selected
5. If not → switch to new scope's default entry kind
6. If no valid config for new scope → self-healing creates default, then proceed

**Protection:** Drafts from one scope never appear in another scope. Cannot accidentally save to wrong scope.

## Proposed Changes

### 1. Database Schema

Add `scope_entry_kinds` configuration table:

```sql
CREATE TABLE public.scope_entry_kinds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  department_profession_id uuid NULL REFERENCES public.department_professions(id) ON DELETE CASCADE,
  -- scope_type derived: 'department' if profession_id is null, 'profession' if set
  entry_kind text NOT NULL CHECK (entry_kind IN ('standard', 'agent_call', 'daily_summary')),
  label text NOT NULL, -- e.g., "Daily Summary" or custom "End of Day Report"
  description text NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  color text NULL, -- hex color for UI theming
  icon text NULL, -- icon name for UI
  created_by uuid NULL REFERENCES auth.users(id),
  updated_by uuid NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Constraints: no table-level unique here; partial unique indexes below handle NULLs correctly
);

-- Partial unique indexes for scope row uniqueness (handles NULL correctly)
CREATE UNIQUE INDEX idx_scope_entry_kinds_dept_row_unique
  ON public.scope_entry_kinds(department_id, entry_kind)
  WHERE department_profession_id IS NULL;

CREATE UNIQUE INDEX idx_scope_entry_kinds_prof_row_unique
  ON public.scope_entry_kinds(department_profession_id, entry_kind)
  WHERE department_profession_id IS NOT NULL;

-- Indexes (corrected for nullable scope)
CREATE INDEX idx_scope_entry_kinds_department
  ON public.scope_entry_kinds(department_id)
  WHERE department_profession_id IS NULL;

CREATE INDEX idx_scope_entry_kinds_profession
  ON public.scope_entry_kinds(department_profession_id)
  WHERE department_profession_id IS NOT NULL;

CREATE INDEX idx_scope_entry_kinds_lookup
  ON public.scope_entry_kinds(department_id, department_profession_id, is_active);

-- Unique default constraints (corrected for nullable scope)
CREATE UNIQUE INDEX idx_scope_entry_kinds_dept_default
  ON public.scope_entry_kinds(department_id)
  WHERE department_profession_id IS NULL AND is_default = true;

CREATE UNIQUE INDEX idx_scope_entry_kinds_prof_default
  ON public.scope_entry_kinds(department_profession_id)
  WHERE department_profession_id IS NOT NULL AND is_default = true;

-- RLS policies
ALTER TABLE public.scope_entry_kinds ENABLE ROW LEVEL SECURITY;
-- SELECT: authenticated users; INSERT/UPDATE/DELETE: admin or departments.manage permission
```

**Migration approach:**

- Create table with schema
- Seed department scopes **eagerly** (limited):
  - All departments get `standard` (active, default)
  - `agent_call` only if department already has questions with `entry_kind = 'agent_call'`
  - `daily_summary` only if department already has questions with `entry_kind = 'daily_summary'`
- Seed profession scopes **lazily** (on first admin access or first profession question)
- Default colors matching current UI
- **Admin surfaces:** use self-healing persisted initialization (creates config on first admin GET if missing)
- **Submitter reads:** use resilience fallback without writes (returns default behavior if no config exists)

### 2. API Endpoints

**GET /api/admin/scope-entry-kinds**
Query params: `departmentId` (required), `departmentProfessionId` (optional)

**Behavior:**

1. Query for configs matching scope
2. If no configs found → **self-healing**: create and persist minimal default config (`standard` active, default)
3. Return sorted by `sort_order`, then `label`

**Response:**

```json
{
  "data": [
    {
      "id": "uuid",
      "entry_kind": "standard",
      "label": "Standard",
      "description": null,
      "sort_order": 0,
      "is_default": true,
      "is_active": true,
      "color": "#6B7280",
      "icon": "FileText"
    }
  ],
  "scope": "department" | "profession",
  "self_healed": true | false
}
```

**PUT /api/admin/scope-entry-kinds**
Body: `{ departmentId, departmentProfessionId?, configs: Array<Config> }`

- **Merge/update only:** Upserts by `(department_id, department_profession_id, entry_kind)` — existing rows not in `configs` are **left untouched** (not deleted/deactivated)
- Creates new records or updates existing
- Does **not** delete omitted entry kinds (explicit delete would be separate DELETE endpoint if needed)
- **UI implication:** Admin UI must explicitly send `is_active = false` when user intends to disable an entry kind; omission leaves it unchanged
- **Note:** DELETE endpoint not implemented in Phase 1; use deactivate instead

**Validation rules:**

- At least one entry kind must be active per scope
- Exactly one entry kind must be marked as default per scope (among active)
- **Hard block:** Cannot deactivate an entry kind that has existing active questions for that scope

### 3. Role Questions Creator Updates

**Current behavior:** Hardcoded tabs `standard | agent_call | daily_summary`

**New behavior:**

1. When department is selected (no profession):
   - Fetch entry kinds for department scope (profession_id = null)
   - Render tabs for active entry kinds
   - Pre-select default entry kind tab
2. When profession is selected:
   - Fetch entry kinds for profession scope (profession_id = set)
   - Render tabs for active entry kinds
   - Pre-select default entry kind tab

3. **UI states for config loading:**
   - **Loading:** Show spinner
   - **Valid config loaded:** Show tabs normally
   - **Self-healed and loaded:** Show tabs, optionally show "initialized default config" toast
   - **Invalid config:** Show error banner "Invalid entry kind configuration" with **"Fix in Settings"** button linking to `/admin/settings/entry-kinds`; existing questions remain **viewable** but adding/saving new questions is **blocked** until config fixed
   - **Config refresh, active tab now inactive:** Auto-switch to new default active entry kind
   - **Fetch/create failure:** Show error "Failed to load entry kinds" with retry button

4. **Department not selected:** Question creation disabled until department chosen (no unscoped drafts)

5. New question gets `entry_kind` from currently active tab

### 4. Role Questions Manager Updates

The grouping by entry_kind already works. Updates needed:

- Use configured labels from scope_entry_kinds (or fallback to hardcoded)
- Use configured colors from scope_entry_kinds
- **Always show all existing questions**, even if entry_kind now inactive (show "(Inactive)" badge)
- Hide sections only if no questions exist for that entry_kind

### 5. Admin UI for Configuration

**New page: `/admin/settings/entry-kinds`**

Layout (scope-first):

1. Department selector (dropdown, required) - must choose first
2. Scope selector: "Department-wide" | Profession dropdown - appears after department chosen
3. Entry kinds list (drag-to-sort or manual sort_order input) - appears after scope selected
   - Each row:
     - Toggle: Active/Inactive
     - Text input: Custom label (presentation-only, does not change system behavior)
     - Color picker: Hex color
     - Icon selector: Lucide icon name
     - Radio: Is default (single selection)
     - Description textarea (optional)
     - **Warning if deactivating would be blocked** (check questions on toggle)

**Validation display:**

- Show error banner if config invalid (no active, or no default)
- Disable "Save" until valid
- Hard block on deactivation with active questions

**Inline config from Questions Creator:**

- "Configure entry kinds for this scope" link when tabs are rendered
- Opens side panel or modal with quick config

### Phase 1A: Database & API (Foundation)

1. Create migration for `scope_entry_kinds` table (corrected indexes)
2. Seed **limited** department configs eagerly
3. Implement **self-healing** profession config creation (GET endpoint creates if missing)
4. Create GET /api/admin/scope-entry-kinds endpoint (with self-healing behavior, returns `self_healed` flag)
5. Create PUT /api/admin/scope-entry-kinds endpoint (with hard-block validation, returns blocking question counts)
6. Add tests for API endpoints

### Phase 1B: Questions Creator Integration

1. Replace hardcoded tabs with dynamic tab loading
2. Update question creation to use active tab's entry_kind
3. Handle loading, self-healed, invalid, and failure UI states (no "empty state" in normal operation due to self-healing)
4. Block question creation until department selected
5. Add link to configure entry kinds

### Phase 1C: Manager Integration

1. Update grouping to use configured labels (with fallback)
2. Update styling to use configured colors
3. **Always show existing questions** (add inactive indicator)
4. Add "(Inactive)" badge for questions in deactivated entry kinds

### Phase 1D: Admin Configuration UI

1. Create entry kinds configuration page
2. Add inline config from questions creator
3. Add validation and error handling

## Key Files to Modify

- `supabase/migrations/2026xxxxxx_add_scope_entry_kinds_table.sql` - New (corrected partial unique indexes)
- `app/api/admin/scope-entry-kinds/route.ts` - New (GET with self-healing for admins, PUT with blocking question counts)
- `components/role-questions-creator.tsx` - Update tabs logic (dynamic loading, scope-partitioned drafts, UI states)
- `components/role-questions-manager.tsx` - Update grouping labels/styling (config-based labels with fallback)
- `app/admin/settings/entry-kinds/page.tsx` - New (scope-first admin UI with deactivation warnings)
- `hooks/use-entry-kinds.ts` - New (SWR hook for scope entry kinds with self-healed flag)
- `lib/entry-kinds.ts` - New (helpers for label resolution, default colors/icons)

## Backward Compatibility

- Existing questions with `entry_kind` remain valid
- Existing constraints on `captain_log_entries` unchanged
- **Limited seeding** reduces noise (not all scopes get all 3 tabs)
- **Admin surfaces:** persisted self-healing initialization (creates minimal default config on first admin GET if missing)
- **Submitter reads:** resilience fallback without writes (returns default behavior if no config exists)
- Graceful degradation: UI always functional even with config issues

## Testing Strategy

1. Unit tests for API endpoints
2. Integration tests for tab rendering based on scope
3. Migration test: verify limited seeding creates correct default configs
4. Edge cases:
   - Department with no professions
   - Profession with no configured entry kinds (**self-healing creates default**)
   - Switching between department and profession scope in creator (**scope-partitioned drafts**)
   - Deactivating entry kind with active questions (**hard block with remediation UI**)
   - Self-healing telemetry logged correctly
   - Config inactive but questions exist (**show with inactive badge**)
   - Race condition: two admins trigger self-healing simultaneously (**second catches conflict, returns existing**)

## Rollout Plan

1. Deploy database migration (backward compatible - new table, self-healing handles missing configs)
2. Deploy API endpoints (self-healing ensures no broken states)
3. Deploy creator updates (feature-flagged if needed)
4. Deploy manager updates
5. Deploy admin config UI
6. Train admins on new configuration

## Acceptance Criteria Summary

| Story | Acceptance Criteria                                                                                                                               |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| A     | Admin can CRUD entry kind configs per scope; validation enforces at least one active, exactly one default, default must be active                 |
| B     | Creator shows tabs from scope config; new questions inherit active tab's entry_kind                                                               |
| C     | Manager shows all existing questions with inactive badge if entry_kind deactivated                                                                |
| D     | Existing questions remain valid; limited seeding reduces noise; no breaking changes                                                               |
| E     | **Admin** GET endpoint self-heals missing config by creating persisted default; submitter reads remain read-only                                  |
| F     | Deactivation blocked with count of blocking questions; remediation path to view questions                                                         |
| G     | Drafts partitioned by scope; switching scopes preserves drafts separately per scope                                                               |
| H     | Config readable by submitter-facing flows via direct table read under RLS (active rows only); actual submitter filtering deferred to future phase |

**Non-functional/Operational Criteria:**

| Area  | Criterion                                                                                                |
| ----- | -------------------------------------------------------------------------------------------------------- |
| Audit | Self-healed config creation and deactivation attempts record the acting admin user ID for audit purposes |

## Future Phase 2 (Not in this plan)

- Custom entry kind keys beyond system values
- Remove check constraint from captain_log_entries
- Add entry_kind_id foreign key
- Full white-label entry kind creation
