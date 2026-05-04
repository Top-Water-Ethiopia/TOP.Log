# RBAC Regression Plan — Department Lead Visibility + Promoter Entry Kinds

Timestamp: **2026-04-22 05:16:11 EAT**

## Problem (Current Regression)

The system regressed across a few commits:

1. Originally (up to git hash `dd9b088d149836c906ac4696d2209927e36a4d6c`), sales promoters could submit logs at `/logs/new`.
2. After that hash, department leads could view all reports for their department.
3. After later commits, department leads could also see all assets/files in their department scope.
4. A later fix attempt restored promoters’ ability to submit, but **department leads can no longer reliably see all reports and attached files**.

## Intended Behavior (User Story)

- As a **Sales Promoter** or **Supervisor**, I can go to `/logs/new`, see the correct **Report Type / entry kind** options for my role in the selected department/date, and submit my report (including file/image answers).
- As a **Department Lead**, I can view **all reports submitted for my department** and **all attached files/images** for those department reports — without giving promoters/supervisors department-wide read access.

## Canonical Scope Rule

Department-wide reporting is scoped by:

- `captain_log_entries.subject_department_id` = the department the report is **about / filed under**

This is the canonical “department scope” for:
- department report listing
- department asset/file listing

## Entry Kinds (What `/logs/new` must show)

Entry-kind options are computed by two sources:

1. **Reachability** via active questions (`role_questions`) for a role/profession scope
2. **Scope config** via configured entry kinds (resolved by `resolveEntryKinds`)

### Scope config fallback (required)

If reachability produces an empty list because questions are incomplete/misaligned, `/logs/new` must **fall back** to configured active entry kinds for that department/role/date (still respecting availability rules like weekdays/date range/is_active).

## Implementation Outline

1. Save this history doc.
2. Replace department-wide file/report visibility checks that depend on access-level **name strings** (e.g. `"department-lead"`) with checks derived from effective **permissions**.
3. Ensure:
   - Promoter/supervisor: submit + see entry kinds.
   - Department lead: see all dept reports + assets.
4. Add regression tests around visibility logic (owner vs department-wide read).

## Acceptance Criteria

- Promoter/supervisor can always choose an entry kind on `/logs/new` for a valid department/date.
- Department lead can see all entries where `subject_department_id = their department`.
- Department lead can see all attached files/images for those entries.
- Promoter/supervisor cannot browse other users’ department-wide files/reports (unless they are the owner).

