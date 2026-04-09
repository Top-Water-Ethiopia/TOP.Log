import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import { MainLayoutUpdated } from "@/components/main-layout-updated"

const mockApiFetch = jest.fn()
const mockUseRoleQuestions = jest.fn()
const mockReplace = jest.fn()
const mockPush = jest.fn()

jest.mock("@/components/calendar-view", () => ({
  CalendarView: () => <div data-testid="calendar-view" />,
}))

jest.mock("@/components/features/daily-log/organisms", () => ({
  EntryDetails: () => <div data-testid="entry-details" />,
}))

jest.mock("@/components/landing-page", () => ({
  LandingPage: ({ onNewReport, newReportDisabledReason }: { onNewReport?: () => void; newReportDisabledReason?: string }) => (
    <div>
      <button onClick={onNewReport} disabled={!!newReportDisabledReason}>
        New Report
      </button>
      {newReportDisabledReason ? <div>{newReportDisabledReason}</div> : null}
    </div>
  ),
}))

jest.mock("@/components/thank-you-page", () => ({
  ThankYouPage: () => <div data-testid="thank-you-page" />,
}))

jest.mock("@/components/search-dialog", () => ({
  SearchDialog: () => <div data-testid="search-dialog" />,
}))

jest.mock("@/components/analytics-dashboard", () => ({
  AnalyticsDashboard: () => <div data-testid="analytics-dashboard" />,
}))

jest.mock("@/hooks/use-role-questions", () => ({
  useRoleQuestions: (...args: unknown[]) => mockUseRoleQuestions(...args),
}))

jest.mock("@/contexts/supabase-log-context", () => ({
  useCaptainLog: () => ({
    entries: [],
  }),
}))

jest.mock("@/hooks/use-rbac", () => ({
  useRBAC: () => ({
    user: { id: "user-1", role: "sales-promoter" },
    userInfo: { role: { name: "Sales Promoter" } },
    permissions: [],
    rbacLoaded: true,
    rbacChecked: true,
    canAccessAdmin: false,
    canCreateEntries: true,
    rbacLoading: false,
  }),
}))

jest.mock("@/contexts/supabase-auth-context", () => ({
  useSupabaseAuth: () => ({
    user: { id: "user-1" },
    isLoading: false,
  }),
}))

jest.mock("@/lib/api-client", () => ({
  ApiError: class ApiError extends Error {
    status: number
    constructor(status: number) {
      super(`API ${status}`)
      this.status = status
    }
  },
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  getErrorMessage: (_err: unknown, fallback: string) => fallback,
}))

jest.mock("@/lib/feature-flags/client", () => ({
  isFeatureEnabledClient: () => false,
}))

jest.mock("@/lib/date-restrictions", () => ({
  canCreateEntryForDate: () => ({ isValid: true }),
  getToday: () => "2026-04-09",
}))

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: mockPush,
  }),
}))

describe("MainLayoutUpdated", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("uses the department profession key when fetching role questions for a sales-promoter membership", async () => {
    mockApiFetch.mockResolvedValue({
      data: [
        {
          department_id: "beb111c3-b4e4-44af-b76d-f36935e40272",
          role: "sales-promoter",
          department_profession: { key: "sales-promoter" },
          department: {
            id: "beb111c3-b4e4-44af-b76d-f36935e40272",
            name: "Sales",
            description: null,
            is_active: true,
          },
        },
      ],
      hasSystemWideAccess: false,
    })

    mockUseRoleQuestions.mockReturnValue({
      questions: [
        {
          id: "q-1",
          key: "agent_report",
          label: "Agent Report",
          type: "text",
          required: true,
          order: 0,
        },
      ],
      isLoading: false,
      error: null,
    })

    render(<MainLayoutUpdated initialRoleQuestions={[]} />)

    await waitFor(() => {
      expect(mockUseRoleQuestions).toHaveBeenCalledWith(
        [],
        "beb111c3-b4e4-44af-b76d-f36935e40272",
        undefined,
        "sales-promoter"
      )
    })

    expect(screen.queryByText("Your role is not configured with role-specific questions yet.")).not.toBeInTheDocument()
  })
})
