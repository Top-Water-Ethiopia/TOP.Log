# Header Spec v1 (Non-Admin)

This document defines the **canonical header contract** for every route **outside the `/admin` section** (even if an Admin button is visible). It is written as a **product decision + QA spec + engineering contract**.

## Decisions (Locked)

1) **Terminology (Canonical): Logs everywhere**
- Use **Logs** consistently in header copy:
  - **All Logs**
  - **New Log**
  - **Back to Logs**
- “Report” is considered legacy wording for header UI on non-admin routes.

2) **Brand click destination**
- Clicking the brand/title always navigates to **`/logs`** on all non-admin routes.

3) **Restricted states: disable + explain**
- When the user is authenticated but **restricted** (no memberships, or cannot create now), keep actions **visible** but **disabled** with a clear reason (tooltip/title text).

4) **Root route `/`**
- `/` is an entrypoint and must **redirect to `/logs`** (admin behavior remains unchanged elsewhere).

## Canonical Header Contract

### Core contract (must be consistent everywhere outside `/admin`)

**A) Brand (left)**
- Title/subtitle (e.g. “Logs” / “Daily Tracker”)
- Click -> **`/logs`**

**B) Secondary navigation**
- **All Logs** -> `/logs`
- May be hidden when already on `/logs` (optional)

**C) Primary CTA**
- **New Log** -> `/logs/new`
- If disabled: CTA remains visible with a reason string.

**D) Admin entrypoint**
- Show **Admin** button only if `canAccessAdmin === true`.
- Navigates to `/admin` (admin section is out-of-scope for this spec).

**E) User menu**
- Show avatar + display name (profile name preferred, else email).
- Includes **Sign out** -> routes to `/login`.
- Must be hydration-safe (avoid SSR/client mismatch).

### Optional modules (page/route may include, not required)
- Search module (feature-flagged)
- Department selector (multi-department context)
- Contextual back action (“Back to Logs”) for deep-linked routes (e.g. `/reports/[id]`)

## QA State Matrix (Testable Expectations)

Legend:
- ✅ visible and enabled
- ⛔ visible but disabled (must include reason text)
- — not shown

### 1) Unauthenticated user
- Brand: ✅ (click -> `/logs`)
- All Logs: —
- New Log: —
- Admin: —
- User menu: —

### 2) Authenticated + memberships present + RBAC loaded
- Brand: ✅ (-> `/logs`)
- All Logs: ✅ (-> `/logs`)
- New Log: ✅ (-> `/logs/new`) OR ⛔ (with reason) if creation currently blocked
- Admin: ✅ only if permitted
- User menu: ✅
- Optional modules appear only if enabled and applicable.

### 3) Authenticated + **no memberships** (“Not assigned”) + RBAC loaded
- Brand: ✅ (-> `/logs`)
- All Logs: ⛔ (reason: no department/membership)
- New Log: ⛔ (reason: no department/membership)
- Admin: ✅ only if permitted
- User menu: ✅

### 4) Authenticated + RBAC loading
- Brand: ✅ (-> `/logs`)
- Avoid flicker/contradictory states for Admin + user menu.
- Secondary/primary actions may render as skeletons or be delayed until RBAC loaded.

## Known Divergences (Tracked)

Priority legend:
- **P1** must align soon (user-visible contract)
- **P2** temporary acceptable divergence

**P1**
- Any non-admin header using “Report” wording (must converge to Logs terminology).
- Any non-admin brand link going anywhere other than `/logs`.
- Hiding primary actions in restricted states (must be visible but disabled + explain).

**P2**
- `/departments/*` using a different user-menu implementation as long as sign-out/navigation capabilities remain equivalent.
- `/profile` using page-local header branches; acceptable temporarily but should converge to the core contract where a header exists.

## Acceptance Criteria (Release Gate)
- On every non-admin route, brand click navigates to **`/logs`**.
- Header copy uses **Logs** terminology (no “New Report” in header CTA).
- When authenticated but restricted, **All Logs** and **New Log** are visible but **disabled with a reason**.
- Admin button appears only when allowed.

