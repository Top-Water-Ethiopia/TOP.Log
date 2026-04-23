import React from "react"
import { render, screen } from "@testing-library/react"
import { LogsList, type FlattenedLogItem } from "@/components/logs/logs-list"
import type { LogEntry } from "@/lib/logs/types"

jest.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 100,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        size: 100,
        start: index * 100,
      })),
  }),
}))

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: jest.fn() }),
}))

const mockUseLogsPageState = jest.fn()
jest.mock("@/hooks/use-logs-page-state", () => ({
  useLogsPageState: () => mockUseLogsPageState(),
}))

function makeLog(overrides: Partial<LogEntry>): LogEntry {
  return {
    id: "log-1",
    date: "2026-04-21",
    department_id: "dept-1",
    department_name: "Marketing",
    created_at: null,
    updated_at: null,
    response_count: 7,
    entry_kind: "agent_call",
    report_kind: "personal",
    subject_profession_id: null,
    subject_agent_name: null,
    subject_agent_snapshot: {
      name: "Ismael Mohamed",
      location: "Mizan Aman",
      phone: null,
    },
    user: { id: "u1", name: "Fraol Tesema" },
    ...overrides,
  }
}

function renderList({
  logs,
  flattenedItems,
  state,
}: {
  logs: LogEntry[]
  flattenedItems: FlattenedLogItem[]
  state: any
}) {
  mockUseLogsPageState.mockReturnValue({ state })
  render(
    <LogsList
      emptyDescription="empty"
      emptyTitle="empty"
      logs={logs}
      flattenedItems={flattenedItems}
      entryKindConfigs={[]}
    />
  )
}

test("shows agent name from snapshot even when subject_agent_name is null (multi-dept)", () => {
  const log = makeLog({ department_id: "dept-1" })
  const otherDeptLog = makeLog({ id: "log-2", department_id: "dept-2", department_name: "Sales" })
  const flattenedItems: FlattenedLogItem[] = [
    {
      id: "header-u1",
      type: "header",
      userId: "u1",
      userName: "Fraol Tesema",
      summary: { totalLogs: 1, lastSubmission: "2026-04-21" },
    },
    { id: log.id, type: "row", userId: "u1", userName: "Fraol Tesema", data: log },
  ]

  renderList({
    logs: [log, otherDeptLog],
    flattenedItems,
    state: { departmentId: null, date: "", month: "", page: 1, searchName: "fra", view: "list" },
  })

  // Department stays primary in multi-dept; agent appears in the meta line.
  expect(document.body.textContent).toContain("Marketing")
  expect(document.body.textContent).toContain("Ismael Mohamed")
})

test("single-dept context makes agent name the primary line", () => {
  const log = makeLog({})
  const flattenedItems: FlattenedLogItem[] = [
    {
      id: "header-u1",
      type: "header",
      userId: "u1",
      userName: "Fraol Tesema",
      summary: { totalLogs: 1, lastSubmission: "2026-04-21" },
    },
    { id: log.id, type: "row", userId: "u1", userName: "Fraol Tesema", data: log },
  ]

  renderList({
    logs: [log],
    flattenedItems,
    state: { departmentId: "dept-1", date: "", month: "", page: 1, searchName: "", view: "list" },
  })

  expect(screen.getAllByText("Ismael Mohamed")[0]).toBeInTheDocument()
})
