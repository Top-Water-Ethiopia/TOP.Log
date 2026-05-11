# Marketing Team Filters (Client-side): Search (ET phones) + Job Position (Normalized)

## Summary
Add a **client-side filter bar** to `/marketing/team` (≤100 members) with:
- Search by **name** + **phone** (only when phone is visible; privacy-safe)
- Filter by **Job Position** (role) using normalized keys
- Phone search supports **ET local `09XXXXXXXX`** and **E.164 `+251…`**, matching against **raw** stored phone.

## Phase 1 — Helpers (single source of truth)
Implement utilities (co-located with Team page unless a shared util already exists):
- `normalizeE164(raw: string): string | null`
  - `const s = raw.replace(/[^\d+]/g, "")`
  - validate `^\+[1-9]\d{7,14}$`, else null
- `digitsOnly(s: string): string` → strip non-digits
- `canonicalRole(label: string): string`
  - `trim → toLowerCase → collapse whitespace`
- `convert09ToE164IfApplicable(qDigits: string, qRaw: string): string | null`
  - if `!qRaw.startsWith("+") && qDigits.length === 10 && qDigits.startsWith("09")`
  - return `"+251" + qDigits.slice(1)` (drop leading `0`)

**Invariants**
- `phoneDigits` must be derived from **validated** `phoneE164` only.
- If `phoneVisible === false`, phone must not be indexed or searchable.

## Phase 2 — UI implementation (client-side filtering)
In `/marketing/team`:
- Add filter bar:
  - Search input `q`
  - Role dropdown `selectedRoleKey` with options `{ key, label }` and `All`
  - Clear button resets `q=""` and `selectedRoleKey="all"`
- Precompute index once after data load:
  - `roleLabel = role.displayName ?? role.name ?? ""`
  - `roleKey = canonicalRole(roleLabel)`
  - `nameKey = (name ?? "").toLocaleLowerCase()`
  - If `phoneVisible && phoneRaw`:
    - `phoneE164 = normalizeE164(phoneRaw)` (else null)
    - `phoneDigits = phoneE164 ? digitsOnly(phoneE164) : ""`
- Build stable role options:
  - Dedupe by `roleKey`
  - Prefer `displayName` label when available
  - Sort by label A–Z
- Search matching:
  - `qRaw = q.trim()`
  - If `qRaw === ""` and role is `all`, show all.
  - `qName = qRaw.toLocaleLowerCase()`
  - `qDigits = digitsOnly(qRaw)`
  - `qE164 = qRaw.startsWith("+") ? normalizeE164(qRaw) : convert09ToE164IfApplicable(qDigits, qRaw)`
  - `phoneMatch` (only if phoneVisible and phoneE164 exists):
    - if `qE164`: `phoneE164.startsWith(qE164)`
    - else if `qDigits.length >= 5`: `phoneDigits.includes(qDigits)`
    - else false
  - include if `(nameMatch || phoneMatch) && roleMatch`
- Performance:
  - Debounce search input (`150ms`) and filter via `useMemo`.
- Stable sort after filtering:
  - roleLabel, then name, then userId.
- UX:
  - “Showing X of Y members”
  - If `meta.hasMore` and filters active: show “Filtering applies to the first 100 loaded members.”
  - Empty states:
    - No members loaded: “No team members found.”
    - No match: `No results for “{qRaw}”.`

## Phase 3 — Tests
Add tests (component/page-level depending on existing setup):
- Phone normalization & matching:
  - stored `+251911234567` matches `0911234567`, `09 112 345 67`, `+251-911-234-567`
  - short digits `<5` does not match by phone
  - if `phoneVisible=false`, phone queries do not match
- Role normalization:
  - `" Sales   Manager "` and `"sales manager"` dedupe to one option and filter identically
- Combined filters + stable ordering

## Phase 4 — Future-proof API note (no API change now)
Reserve params for later server-side filtering:
- `/api/marketing/team?q=&role=&limit=&cursor=`

**IMPORTANT:** when server-side filtering is introduced, it must reuse the exact same `canonicalRole()` and ET phone normalization (`09…` ↔ `+251…`) to avoid UX drift.

## Acceptance Checks
- Search `09...` finds members whose stored phones are `+251...` (when visible).
- Phone is never searchable when restricted.
- Role dropdown doesn’t duplicate roles due to casing/spacing differences.
- When there are >100 members (`hasMore=true`), filtering messaging makes the limitation explicit.

