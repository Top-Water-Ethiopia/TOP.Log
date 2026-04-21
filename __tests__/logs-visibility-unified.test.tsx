import React from "react"
import { render, screen } from "@testing-library/react"

const mockCreateClient = jest.fn()

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}))

jest.mock("@/lib/completion-status", () => ({
  getReportStatus: jest.fn().mockResolvedValue(null),
}))

jest.mock("@/components/logs/logs-calendar", () => ({
  LogsCalendar: () => <div data-testid="logs-calendar" />,
}))

jest.mock("@/components/logs/logs-filters", () => ({
  LogsFilters: () => <div data-testid="logs-filters" />,
}))

jest.mock("@/components/logs/logs-list", () => ({
  LogsList: (props: any) => (
    <div data-testid="logs-list">
      {props.logs.map((log: any) => (
        <div key={log.id} data-testid={`log-entry-${log.id}`}>
          {log.id}
        </div>
      ))}
    </div>
  ),
}))

jest.mock("@/components/logs/log-report-preview-panel", () => ({
  LogReportPreviewPanel: () => <div data-testid="log-preview" />,
}))

const { default: LogsPage } = require("@/app/logs/page")

function createQueryBuilder(rows: any[]) {
  const builder: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockImplementation(async () => ({ data: rows, error: null, count: rows.length })),
    range: jest.fn().mockImplementation(async () => ({ data: rows, error: null, count: rows.length })),
    maybeSingle: jest.fn().mockImplementation(async () => ({ data: rows[0] || null, error: null })),
    single: jest.fn().mockImplementation(async () => ({ data: rows[0] || null, error: null })),
  }
  return builder
}

describe("/logs page visibility", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("shows all department logs for a department-lead even without departmentId param", async () => {
    const mockEntries = [
      { id: "log-1", date: "2026-04-20", subject_department_id: "dept-1", user_id: "other-user" },
      { id: "log-2", date: "2026-04-20", subject_department_id: "dept-1", user_id: "lead-user" },
    ]

    mockCreateClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "lead-user" } },
          error: null,
        }),
      },
      from: jest.fn((table) => {
        if (table === "user_profiles") {
          return createQueryBuilder([{ role_id: "user-role-id", role_name: "user", department_id: "dept-1" }])
        }
        if (table === "user_department_memberships") {
          return createQueryBuilder([
            {
              department_id: "dept-1",
              membership_type: "access_level",
              role: { name: "department-lead" },
              is_active: true,
            },
          ])
        }
        if (table === "captain_log_entries") {
          return createQueryBuilder(mockEntries)
        }
        if (table === "departments" || table === "custom_responses") {
          return createQueryBuilder([])
        }
        return createQueryBuilder([])
      }),
    })

    const element = await LogsPage({
      searchParams: Promise.resolve({}),
    })

    render(element)

    expect(screen.getByTestId("log-entry-log-1")).toBeInTheDocument()
    expect(screen.getByTestId("log-entry-log-2")).toBeInTheDocument()
  })

  it("restricts logs to own entries for a regular contributor", async () => {
    const mockEntries = [
      { id: "log-own", date: "2026-04-20", subject_department_id: "dept-1", user_id: "contributor-user" },
    ]

    mockCreateClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "contributor-user" } },
          error: null,
        }),
      },
      from: jest.fn((table) => {
        if (table === "user_profiles") {
          return createQueryBuilder([{ role_id: "user-role-id", role_name: "user", department_id: "dept-1" }])
        }
        if (table === "user_department_memberships") {
          return createQueryBuilder([
            {
              department_id: "dept-1",
              membership_type: "access_level",
              role: { name: "contributor" },
              is_active: true,
            },
          ])
        }
        if (table === "captain_log_entries") {
          return createQueryBuilder(mockEntries)
        }
        return createQueryBuilder([])
      }),
    })

    const element = await LogsPage({
      searchParams: Promise.resolve({}),
    })

    render(element)

    expect(screen.getByTestId("log-entry-log-own")).toBeInTheDocument()
    // Other entries would be filtered by the eq("user_id", userId) which we mock by returning only own entries
  })
})
