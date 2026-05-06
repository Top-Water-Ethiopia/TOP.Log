# Agent Contact Outcome Analytics (Marketing) — Plan

Timestamp (EAT): `2026-05-04_18-25_EAT`

## Goal
For Marketing department leads, show outcome analytics for agent contact entries:
- **Success / Failed / Missing** counts
- Failure reason breakdown (multi-select, deduped per entry)

This is scoped to `captain_log_entries.entry_kind = 'agent_contact'` only.

## Canonical Question Keys
- Success: `were_you_able_to_reach_the_agent` (stored values observed: `"Yes"` / `"No"`)
- Failure reasons: `why_was_the_contact_unsuccessful` (stored values observed as JSON arrays of strings)

## TimeWindow Integration
Use the existing server-authoritative TimeWindow resolver:
- Inputs: `preset` XOR `date` XOR (`dateFrom` + `dateTo`)
- Timezone: `Africa/Addis_Ababa`
- Canonical window identity: `window.key = start:end`

## Classification (single source of truth)
Outcome is a pure function of success value:
- `"Yes"` ⇒ `success`
- `"No"` ⇒ `failed`
- Anything else (missing/empty/unknown) ⇒ `missing`

Reasons never override outcome classification.

## Reason Parsing + Normalization
- Only count reasons for entries classified as `failed`.
- Parse `custom_responses.value`:
  - If JSON array: take string elements only
  - Else: treat as empty
- Valid reason: string with `trim().length > 0`
- Normalize: `lower(trim(reason))`
- Deduplicate per entry: count each normalized reason at most once per entry.
- If `failed` and has zero valid reasons ⇒ bucket `unspecified`.

## API Contract
`GET /api/marketing/kpis/agent-contact-outcomes`
- Inputs: same TimeWindow query params
- AuthZ: same department-lead gating as other marketing KPIs
- Output:
  - `totals`: `{ total, success, failed, missing }`
  - `rates`: `{ successRate: success/(success+failed), missingRate: missing/total }`
  - `reasons`: dynamic map of canonical reason buckets + `unspecified`
  - `meta`: includes multi-select semantics and timezone

## Chart Semantics
Reasons are multi-select:
- Display as **bar chart** by default
- Label as “% of failed contacts selecting each reason (multi-select allowed)”

## Acceptance Checks
- Department lead sees correct totals for a known date range.
- Missing is not counted as failed; success rate excludes missing from denominator.
- Reasons are counted once per entry per normalized reason; invalid/empty elements are ignored.

## Tests
- Unit tests for:
  - `classifyOutcome("Yes"|"No"|null|unknown)`
  - reason parsing/normalization/dedupe
  - `unspecified` computation for failed entries with no reasons

