import { applySearchPostFilters } from "@/lib/logs/search-post-filters"
import type { LogEntry } from "@/lib/logs/types"

function makeLog(overrides: Partial<LogEntry>): LogEntry {
  return {
    id: "id",
    date: "2026-04-23",
    department_id: "dept-1",
    department_name: "Marketing",
    created_at: null,
    updated_at: null,
    response_count: 0,
    entry_kind: "standard",
    report_kind: "personal",
    subject_profession_id: null,
    subject_agent_name: null,
    subject_agent_snapshot: null,
    user: { id: "u1", name: "User" },
    ...overrides,
  }
}

test("filters by professionRoleId", () => {
  const logs = [
    makeLog({ id: "a", subject_profession_id: "prof-1" }),
    makeLog({ id: "b", subject_profession_id: "prof-2" }),
    makeLog({ id: "c", subject_profession_id: null }),
  ]

  const result = applySearchPostFilters(logs, { professionRoleId: "prof-1" })
  expect(result.map((l) => l.id)).toEqual(["a"])
})

test("filters by entryKind", () => {
  const logs = [makeLog({ id: "a", entry_kind: "agent_call" }), makeLog({ id: "b", entry_kind: "daily_summary" })]

  const result = applySearchPostFilters(logs, { entryKind: "agent_call" })
  expect(result.map((l) => l.id)).toEqual(["a"])
})

test("filters by both professionRoleId and entryKind", () => {
  const logs = [
    makeLog({ id: "a", subject_profession_id: "prof-1", entry_kind: "agent_call" }),
    makeLog({ id: "b", subject_profession_id: "prof-1", entry_kind: "daily_summary" }),
    makeLog({ id: "c", subject_profession_id: "prof-2", entry_kind: "agent_call" }),
  ]

  const result = applySearchPostFilters(logs, { professionRoleId: "prof-1", entryKind: "agent_call" })
  expect(result.map((l) => l.id)).toEqual(["a"])
})
