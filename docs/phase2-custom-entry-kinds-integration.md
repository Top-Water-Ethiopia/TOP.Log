# Phase 2: Custom Entry Kind Keys by Scope (Final)

Enable admin-created custom entry kind keys per scope with normalized lowercase keys, enforced format rules, capability-based assigned-agent workflows, and explicit legacy data handling.

## Current State Verification

### ✅ Already Implemented (Phase 1)

- `scope_entry_kinds` table with correct schema (`department_id`, `department_profession_id`)
- GET/PUT API with self-healing, validation, deactivation blocking
- `useScopeEntryKinds(departmentId, departmentProfessionId?)` hook
- Admin settings page (edit existing keys only)
- `role-questions-manager.tsx` uses config-based labels

### ❌ Missing for True Custom Keys (Phase 2)

1. **Admin UI cannot CREATE new custom keys** - only edits seeded keys
2. **`entry_kind` still typed as union** instead of `string`
3. **No assigned-agent capability flag** in schema or UI
4. **Creator doesn't use scope-loaded options** - still hardcoded
5. **No DB-level key format enforcement** - validation only in UI
6. **Legacy data migration story unclear**

## Revised Tasks

### 1. Update Database Schema

Add capability flag and key format validation:

```sql
-- Add capability flag
ALTER TABLE public.scope_entry_kinds
ADD COLUMN supports_assigned_agent BOOLEAN NOT NULL DEFAULT false;

-- Remove CHECK constraint if it exists on entry_kind column
-- Note: CHECK constraint may not exist; verify before dropping
ALTER TABLE public.scope_entry_kinds
DROP CONSTRAINT IF EXISTS scope_entry_kinds_entry_kind_check;

-- Add format validation at DB layer
-- Keys: lowercase alphanumeric + underscore, 1-50 chars, no spaces
ALTER TABLE public.scope_entry_kinds
ADD CONSTRAINT scope_entry_kinds_key_format CHECK (
  entry_kind ~ '^[a-z0-9_]+$' AND length(entry_kind) <= 50
);
```

**Key Format Rules (enforced at UI + API + DB):**

- Pattern: `^[a-z0-9_]+$` (lowercase alphanumeric + underscore)
- Length: 1-50 characters
- No spaces, no uppercase letters
- Keys normalized to lowercase on creation (UI enforces, API validates, DB checks)
- Display label handles human-readable casing
- Unique within scope (already enforced by partial unique index)

**Rationale for lowercase:** Prevents accidental duplicates like `daily_report` vs `Daily_Report` vs `daily_Report`, making keys predictable and maintainable.

### 2. Update Admin Entry Kind Management UI

**Clarified lifecycle: "Retire/Deactivate" not "Delete"**

**Add "Create New Entry Kind" functionality:**

- Button: "+ Create Entry Kind"
- Modal/Form fields:
  - **Key**: text input, required
    - Auto-normalizes to lowercase on input/blur
    - Validation: lowercase alphanumeric + underscore, 1-50 chars
    - Real-time format validation with error message
    - Check uniqueness within scope on blur
  - **Label**: text input, required (display name, can have any casing)
  - **Description**: text input, optional
  - **Supports Assigned Agent**: checkbox (capability flag)
  - **Color**: color picker
  - **Icon**: select dropdown (FileText, Phone, Calendar, BarChart, etc.)
- **Create API**: `POST /api/admin/scope-entry-kinds` (single create, not bulk)
  - API normalizes key to lowercase before saving
  - Rejects mixed-case or uppercase keys with 400 error
- **Immutable after creation**: Key field disabled for existing entry kinds

**Retire/Deactivate (not Delete):**

- Terminology: "Retire" or "Deactivate" (not "Delete")
- Action: Set `is_active = false`
- Hard delete: Not supported in Phase 2
- Deactivation blocked if active questions exist (already implemented)

**Update existing editing UI:**

- Add "Supports Assigned Agent" toggle to each entry kind card
- Key field: show as read-only text (immutable)
- "Retire" button (instead of "Delete")

**Settings API clarification:**

- `POST /api/admin/scope-entry-kinds` - Create new key (normalizes key to lowercase, rejects only if post-normalization still violates pattern/length)
- `PUT /api/admin/scope-entry-kinds` - Bulk update existing keys (label, description, color, icon, is_active, is_default, supports_assigned_agent)
- Omitted keys in PUT payload remain unchanged (not retired)
- Key creation is separate endpoint, not part of bulk PUT

**Lowercase normalization behavior:**

- UI: Auto-normalizes to lowercase on input/blur (proactive)
- API: Normalizes defensively before validation (accepts mixed-case input, normalizes, then validates)
- API only rejects if post-normalization value violates pattern/length rules
- This avoids needless 400s for harmless casing differences

### 3. Update Type Definitions

```typescript
// hooks/use-entry-kinds.ts
export interface ScopeEntryKind {
  id: string;
  department_id: string;
  department_profession_id: string | null;
  entry_kind: string; // Changed from union
  label: string;
  description: string | null;
  sort_order: number;
  is_default: boolean;
  is_active: boolean;
  supports_assigned_agent: boolean; // NEW
  color: string | null;
  icon: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}
```

**Compile-time sweep for hardcoded assumptions:**

- `lib/marketing-agents.ts`: Replace `EntryKind` union with `string`
- `components/role-questions-creator.tsx`: Remove hardcoded `entry_kind` checks
- `components/role-questions-manager.tsx`: Update grouping logic
- `app/api/admin/role-questions/bulk/route.ts`: Replace enum validation
- Remove any `switch (entry_kind)` statements, replace with config lookup

### 4. Update `components/role-questions-creator.tsx`

**Scope-aware entry kind loading:**

```typescript
const { entryKinds, isLoading, error, selfHealed } = useScopeEntryKinds(
  selectedDepartment?.id || null,
  selectedProfession?.id || null, // profession ID from department_professions table
);
```

**Scope change + draft preservation behavior:**

- Drafts are **per scope** (stored by department_id + profession_id)
- When scope changes:
  1. Check if unsaved changes exist for current scope
  2. If yes, show confirmation: "You have unsaved changes. Switch scope and keep this draft for later?"
  3. If user confirms without saving, **preserve draft in scope-partitioned storage** (don't discard)
  4. Load draft for new scope if it exists, otherwise start fresh
  5. Re-fetch entry kinds for new scope
  6. Update available dropdown options

**Self-heal failure handling:**

- If self-heal fails (API error creating default config):
  - Block question creation
  - Show error: "Failed to load report types. Please try again or contact support."
  - Provide retry button to re-fetch
  - Do not silently fall back to any default

**Note on self-heal scope:** Self-healing (auto-creating default config) applies only to admin question management flows, not submitter report entry. Submitters read existing config only; if missing, they see error rather than triggering config creation.

**Dropdown behavior:**

- **Active entry kinds**: Normal styling, selectable
- **Inactive entry kinds**: Disabled option with gray styling + "(Inactive)" suffix
- **Legacy entry kind** (question has key not in current scope):
  - Show selected with orange "Legacy" badge
  - Helper text: "This report type is no longer configured for this scope."
  - Cannot be selected for NEW questions

**Legacy save behavior (explicit rules):**

1. **Editing existing question + not touching entry_kind dropdown**:
   - Save ALLOWED even if entry_kind is inactive/legacy
   - Show warning toast: "Question uses retired report type"
2. **Editing existing question + changing entry_kind to new value**:
   - Can ONLY select from active entry kinds in current scope
   - Cannot select inactive or legacy values
3. **New question**:
   - Can ONLY select from active entry kinds in current scope
   - POST rejected if entry_kind is inactive/invalid

**Defaulting rules:**

1. New question + scope has active default → use scope default
2. New question + scope default is inactive → use first active entry kind (lowest sort_order)
3. New question + no scope config → wait for self-heal, then use default
4. Editing existing → preserve stored entry_kind (no re-defaulting)
5. Editing + stored key no longer in scope → show legacy warning, preserve value, allow save

**Assigned-agent workflow (capability-based):**

- When `option_source_kind === ASSIGNED_AGENTS_OPTION_SOURCE_KIND`:
  - **New question**: Filter dropdown to only `supports_assigned_agent = true` options
  - **Existing question with incompatible entry_kind**:
    - Show current selected value (even if incompatible)
    - Show warning banner: "This question uses a report type that doesn't support assigned agents."
    - Dropdown shows only compatible options for changing
    - Allow save without changing (preserve existing), but warn
  - If no compatible entry kind exists: Show error "No report type supports assigned agents in this scope. Create one in settings."

### 5. Update `app/api/admin/role-questions/bulk/route.ts`

**Replace fixed enum validation with scope-aware validation:**

```typescript
// Key format validation (same rules as DB - lowercase only)
const KEY_REGEX = /^[a-z0-9_]+$/;
function isValidKeyFormat(key: string): boolean {
  return KEY_REGEX.test(key) && key.length <= 50;
}
```

// Scope validation
async function getScopeEntryKinds(
supabase: SupabaseClient,
departmentId: string,
departmentProfessionId: string | null,
): Promise<ScopeEntryKind[]> {
const { data } = await supabase
.from("scope_entry_kinds")
.select("\*")
.eq("department_id", departmentId)
.eq("department_profession_id", departmentProfessionId);
return data || [];
}

**Validation rules:**

- `entry_kind` format: lowercase alphanumeric + underscore, 1-50 chars
- `entry_kind` must exist in scope config (for POST and PUT new rows)
- `entry_kind` for existing rows: allow preserving even if inactive/missing from config
- POST: omitted → use scope's active default (`is_default = true AND is_active = true`)
- PUT: omitted for existing row → preserve stored value
- PUT: omitted for new row → use scope's active default
- Assigned agent: validate `supports_assigned_agent = true` if `option_source_kind === ASSIGNED_AGENTS`

### 6. Legacy Data Migration Story (Explicit)

**How existing data continues to work:**

- Existing questions with `entry_kind = "standard"`, `"agent_call"`, `"daily_summary"` keep working
- These are pre-seeded as "system keys" in the `scope_entry_kinds` table during migration
- Admins can:
  - Edit labels/descriptions of system keys
  - Deactivate system keys (if no active questions)
  - Create new custom keys alongside system keys
- Legacy questions with deactivated system keys:
  - Remain visible with "Legacy" badge
  - Can be edited (other fields)
  - Cannot assign that entry kind to NEW questions

**Migration script with capability defaults:**

**Note on ON CONFLICT:** The migration uses `ON CONFLICT (department_id, entry_kind) WHERE department_profession_id IS NULL` which targets the existing partial unique index `idx_scope_entry_kinds_dept_row_unique`. This ensures reliable conflict handling during rollout.

**Limited seeding philosophy:** Only `standard` is seeded for all departments (as default). `agent_call` and `daily_summary` are seeded only where questions already exist with those entry kinds (existing-usage heuristic), avoiding unnecessary clutter.

```sql
-- All departments get 'standard' (default, active, no assigned agent support)
INSERT INTO scope_entry_kinds (
  department_id, department_profession_id, entry_kind, label,
  description, sort_order, is_default, is_active, supports_assigned_agent, color, icon
)
SELECT
  d.id as department_id,
  NULL::uuid as department_profession_id,
  'standard' as entry_kind,
  'Standard' as label,
  'Default report type for general entries' as description,
  0 as sort_order,
  true as is_default,
  true as is_active,
  false as supports_assigned_agent,
  '#6B7280' as color,
  'FileText' as icon
FROM public.departments d
ON CONFLICT (department_id, entry_kind) WHERE department_profession_id IS NULL
DO UPDATE SET
  supports_assigned_agent = false;

-- 'agent_call' only where questions already use it (limited seeding)
INSERT INTO scope_entry_kinds (
  department_id, department_profession_id, entry_kind, label,
  description, sort_order, is_default, is_active, supports_assigned_agent, color, icon
)
SELECT DISTINCT
  rq.department_id,
  NULL::uuid,
  'agent_call',
  'Agent Call',
  'Used for agent-linked reports with assigned agent dropdown',
  1,
  false,
  true,
  true,  -- supports assigned agents
  '#3B82F6',
  'Phone'
FROM public.role_questions rq
WHERE rq.entry_kind = 'agent_call'
ON CONFLICT (department_id, entry_kind) WHERE department_profession_id IS NULL
DO UPDATE SET supports_assigned_agent = true;

-- 'daily_summary' only where questions already use it (limited seeding)
INSERT INTO scope_entry_kinds (
  department_id, department_profession_id, entry_kind, label,
  description, sort_order, is_default, is_active, supports_assigned_agent, color, icon
)
SELECT DISTINCT
  rq.department_id,
  NULL::uuid,
  'daily_summary',
  'Daily Summary',
  'Used for once-per-day summary reports',
  2,
  false,
  true,
  false,  -- does not support assigned agents
  '#10B981',
  'Calendar'
FROM public.role_questions rq
WHERE rq.entry_kind = 'daily_summary'
ON CONFLICT (department_id, entry_kind) WHERE department_profession_id IS NULL
DO UPDATE SET supports_assigned_agent = false;
```

**Rationale for capability defaults:**

- `agent_call`: `true` - This was the legacy behavior (agent call reports required assigned agents)
- `standard`: `false` - General reports don't need assigned agents
- `daily_summary`: `false` - Daily summaries don't need assigned agents

### 7. Update Shared Helpers

**`lib/entry-kinds.ts`:**

```typescript
// Config-driven helpers
export function getDefaultEntryKindForScope(
  entryKinds: ScopeEntryKind[],
): string | null {
  const active = entryKinds.filter((k) => k.is_active);
  const defaultKind = active.find((k) => k.is_default);
  return defaultKind?.entry_kind || active[0]?.entry_kind || null;
}

export function isValidEntryKind(
  entryKind: string,
  entryKinds: ScopeEntryKind[],
): boolean {
  return entryKinds.some((k) => k.entry_kind === entryKind && k.is_active);
}

export function supportsAssignedAgent(
  entryKind: string,
  entryKinds: ScopeEntryKind[],
): boolean {
  return entryKinds.some(
    (k) => k.entry_kind === entryKind && k.supports_assigned_agent,
  );
}

export function getEntryKindConfig(
  entryKind: string,
  entryKinds: ScopeEntryKind[],
): ScopeEntryKind | undefined {
  return entryKinds.find((k) => k.entry_kind === entryKind);
}

// Key format validation (shared between UI and API)
// Enforces lowercase-only machine keys
export const ENTRY_KIND_KEY_REGEX = /^[a-z0-9_]+$/;
export const ENTRY_KIND_MAX_LENGTH = 50;

export function isValidEntryKindKey(key: string): {
  valid: boolean;
  error?: string;
} {
  if (!key) return { valid: false, error: "Key is required" };
  if (key.length > ENTRY_KIND_MAX_LENGTH)
    return {
      valid: false,
      error: `Key must be ${ENTRY_KIND_MAX_LENGTH} characters or less`,
    };
  if (!ENTRY_KIND_KEY_REGEX.test(key)) {
    // Check if it's just a case issue
    if (/^[a-zA-Z0-9_]+$/.test(key) && key !== key.toLowerCase()) {
      return {
        valid: false,
        error:
          "Key must be lowercase only (e.g., 'daily_report' not 'Daily_Report')",
      };
    }
    return {
      valid: false,
      error:
        "Key must contain only lowercase letters, numbers, and underscores",
    };
  }
  return { valid: true };
}

// Normalize key to lowercase (call before saving)
export function normalizeEntryKindKey(key: string): string {
  return key.toLowerCase().trim();
}
```

**`lib/marketing-agents.ts`:**

- Remove: `export type EntryKind = "standard" | "agent_call" | "daily_summary"`
- Replace with: `export type EntryKind = string`
- Remove hardcoded switch statements
- Use `supportsAssignedAgent()` helper instead of checking `entry_kind === "agent_call"`

## Acceptance Criteria (Final)

### 1. Admin-defined entry kinds

- [ ] Admin can create new custom entry kind keys with enforced format
- [ ] Key format validated at UI, API, and DB layers (lowercase alphanumeric + underscore, 1-50 chars)
- [ ] Keys normalized to lowercase on creation
- [ ] Immutable keys after creation
- [ ] One active default per scope
- [ ] Separate create endpoint from bulk update

### 2. Retire/deactivate lifecycle (not delete)

- [ ] Terminology uses "Retire" or "Deactivate"
- [ ] Soft delete via `is_active = false`
- [ ] Hard delete not supported in Phase 2
- [ ] Deactivation blocked if active questions exist

### 3. Question creation with scope-loaded options

- [ ] Creator loads entry kinds from selected scope
- [ ] Department-only: department-wide scope
- [ ] Department + profession: profession-specific scope
- [ ] No scope merging
- [ ] New questions default to scope's active default
- [ ] Self-heal failure: blocks creation with error, shows retry (no silent fallback)
- [ ] No valid active default or no active keys: add/save blocked, error shown

### 4. Legacy save behavior (explicit)

- [ ] Existing question + not changing entry_kind: save allowed even if legacy/inactive
- [ ] Existing question + changing entry_kind: can only select active keys
- [ ] New question: can only select active keys
- [ ] POST rejects inactive/invalid entry_kind
- [ ] PUT preserves legacy/inactive for existing rows

### 5. UX for inactive/legacy entry kinds

- [ ] Inactive keys: disabled in dropdown with "(Inactive)" suffix
- [ ] Legacy keys: orange "Legacy" badge, persistent inline helper text explaining scope mismatch (not repeated toasts)
- [ ] Warning shown on save if legacy/inactive key used, but not repeatedly on every unrelated edit

### 6. Assigned-agent workflow (capability-based)

- [ ] Schema includes `supports_assigned_agent` boolean
- [ ] Migration sets correct defaults: agent_call=true, standard=false, daily_summary=false
- [ ] Admin UI shows toggle
- [ ] Creator filters dropdown for new questions
- [ ] Existing incompatible questions: show warning, allow save without changing
- [ ] Validation enforces capability match

### 7. Scope isolation + draft preservation

- [ ] Drafts stored per scope (department + profession)
- [ ] Scope change shows confirmation if unsaved changes exist
- [ ] Drafts preserved after confirmation (not discarded)
- [ ] Re-fetch entry kinds on scope change

### 8. Type safety (config-driven)

- [ ] `entry_kind` is `string` not union
- [ ] All code uses scope config for labels/colors/behavior
- [ ] Config-driven helper utilities
- [ ] Key format validation shared UI/API

### 9. Legacy data migration

- [ ] Existing `"standard"`, `"agent_call"`, `"daily_summary"` values keep working
- [ ] System keys pre-seeded during migration
- [ ] Admins can edit/deactivate system keys
- [ ] New custom keys coexist with system keys

## Files to Modify

### Database

- `supabase/migrations/20260406xxxx_add_supports_assigned_agent.sql` - add column, key format constraint

### Admin Settings

- `app/admin/settings/entry-kinds/page.tsx` - add create key modal, retire terminology, capability toggle
- `app/api/admin/scope-entry-kinds/route.ts` - add POST for create, handle capability flag

### Creator

- `components/role-questions-creator.tsx` - scope-aware loading, dynamic dropdown, legacy handling, draft preservation
- `hooks/use-entry-kinds.ts` - update type, add `supports_assigned_agent`

### Backend

- `app/api/admin/role-questions/bulk/route.ts` - scope-aware validation, key format check

### Shared

- `lib/entry-kinds.ts` - config-driven helpers, key format validation
- `lib/marketing-agents.ts` - replace union with string, capability-based checks
- `components/role-questions-manager.tsx` - remove hardcoded grouping

## User Stories Covered (Final)

**Core story:**

> As an admin, I want to manage reusable custom entry kind keys for a department-wide scope or a profession-specific scope, so I can define report types that fit my team's workflow.

**Child stories:**

> As a system owner, I want custom keys to follow enforced format rules at the API and database layers, so identifiers stay safe and consistent.

> As an admin, I want to retire entry kinds safely without breaking existing questions, so lifecycle management is clear and non-destructive.

> As an admin, I want existing legacy or incompatible entry kinds to remain editable only in a controlled way, so I can preserve old data without assigning obsolete values to new questions.

> As an admin, I want machine keys to be normalized and predictable, so I do not accidentally create duplicate report types that differ only by capitalization.

> As a system owner, I want normalization and validation rules to behave consistently across UI, API, and DB, so harmless casing differences do not produce confusing API failures.

> As a product owner, I want migration and conflict-handling to be precise and reliable, so rollout of seeded system keys does not fail or produce unintended clutter.

> As an admin, I want to be reminded that a question uses a legacy report type without being repeatedly interrupted when saving unrelated edits.

> As a system owner, I want assigned-agent workflows to be enforced through an explicit capability rule, so custom entry kind keys do not break required report behavior.

> As a product owner, I want legacy entry kind values to keep working after custom keys are introduced, so historical questions and current workflows do not break during migration.

> As an admin, I want scope changes to preserve my drafts predictably, so I do not lose work while moving between department-wide and profession-specific contexts.

> As an admin, I want entry kinds defined for one scope to stay isolated from other scopes, so department-wide and profession-specific question sets do not leak report types into each other.
