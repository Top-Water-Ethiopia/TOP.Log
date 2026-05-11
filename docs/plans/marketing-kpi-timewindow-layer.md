# Marketing KPI TimeWindow Layer (Agent Calls) — Implementation Plan

This plan implements a canonical **TimeWindow** platform layer and upgrades the Marketing KPI to support **preset-first date filtering** with strict contracts, visibility alignment, caching safety, and URL-driven UI state.

## Phases

### Phase 1 — TimeWindow contract + server resolver

- Add shared types: `TimeWindow`, `TimeWindowPreset`.
- Add server resolver:
  - strict XOR: `preset` XOR `date` XOR (`dateFrom` + `dateTo`)
  - deterministic server “today” in `Africa/Addis_Ababa`
  - canonicalization: `window.key = start:end`
  - stable versioned hash: `sha256(v1|start|end|departmentId)`
- Add structured errors (`code`, `message`, `suggestedPreset`, `maxLiveDays`).

### Phase 2 — KPI API upgrade

- Update `/api/marketing/kpis/agent-calls`:
  - accept `preset=` (first-class), `date=` (legacy), `dateFrom/dateTo` (custom)
  - enforce guardrails: `maxDays`, `liveMaxDays`, reject future dates, reject `start>end`
  - compute cache key: `user_id + department_id + window.key + visibility_signature`
  - add single-flight per cache key
- Response includes `window` and `meta` (aggregation + future-proof `series` container).

### Phase 3 — UI: URL-driven date filter

- Add filter bar on `/marketing`:
  - presets + custom start/end
  - URL state (`?preset=last7` or `?dateFrom=...&dateTo=...`)
  - AbortController + requestId race protection
  - dynamic empty state: “No agent calls recorded in this period.”

### Phase 4 — Tests + ops hardening

- Canonicalization test:
  - `preset=last7` and equivalent `dateFrom/dateTo` resolve to the same `window.key`.
- Cache separation test:
  - same window, different visibility signature must not reuse cached values.
- Visibility equivalence:
  - KPI count must match logs-visible count filtered to `agent_call` for the same window (when feasible to test).
- Observability:
  - log `window.hash`, `visibility_signature`, `cache.hit`, `latencyMs`.

## Acceptance Checks

- `/marketing?preset=yesterday` shows KPI and survives refresh.
- API rejects ambiguous inputs and returns structured error payloads.
- KPI never exceeds logs-visible count (equivalence guard).
