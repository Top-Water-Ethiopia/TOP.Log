import React from "react"
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react"
import { EntryFormMultistep } from "@/components/entry-form-multistep"
import { useRoleQuestions } from "@/hooks/use-role-questions"

// Mock the hooks and contexts
jest.mock("@/hooks/use-role-questions")
jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ isAuthenticated: true, user: { id: "user-1" } }),
}))
jest.mock("@/contexts/supabase-auth-context", () => ({
  useSupabaseAuth: () => ({ user: { id: "user-1" } }),
}))
jest.mock("@/contexts/supabase-log-context", () => ({
  useCaptainLog: () => ({ addEntry: jest.fn() }),
}))
jest.mock("@/hooks/use-rbac", () => ({
  useRBAC: () => ({
    validateResponse: () => null,
    processResponses: () => ({ processedResponses: [] }),
  }),
}))

// Mock the ReportTypeSelector's internal API call
const mockFetch = jest.fn()
global.fetch = mockFetch as any

describe("Sales Promoter Selection Flow", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    window.localStorage.clear()
    jest.spyOn(window, "confirm").mockReturnValue(true)
    global.fetch = mockFetch as any
  })

  it("shows the report type selection screen when multiple entry kinds are available", async () => {
    // 1. Mock the API with conditional responses:
    // - With role: returns only profession questions
    // - Without role: returns only department questions
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("role=")) {
        return Promise.resolve({
          ok: true,
          json: async () => [{ id: "q2", entry_kind: "major_activity", question_label: "Activity Q" }],
        })
      }
      return Promise.resolve({
        ok: true,
        json: async () => [{ id: "q1", entry_kind: "standard", question_label: "Standard Q" }],
      })
    })

    // 2. Mock useRoleQuestions to initially return empty (since entryKind is null)
    ;(useRoleQuestions as jest.Mock).mockReturnValue({
      questions: [],
      isLoading: false,
    })

    await act(async () => {
      render(
        <EntryFormMultistep
          departmentId="dept-1"
          role="sales-promoter"
          onSave={() => {}}
          onCancel={() => {}}
        />
      )
    })

    // 3. Verify the selection screen appears
    await waitFor(() => {
      expect(screen.getByText(/Select Report Type/i)).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /Major Activity/i })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /Standard/i })).toBeInTheDocument()
    }, { timeout: 3000 })

    // 4. Select "Major Activity"
    fireEvent.click(screen.getByRole("button", { name: /Major Activity/i }))

    // 5. Verify that useRoleQuestions is now called with "major_activity"
    await waitFor(() => {
      expect(useRoleQuestions).toHaveBeenCalledWith(
        undefined,
        "dept-1",
        "major_activity"
      )
    })
  })

  it("auto-skips the selection screen if only one entry kind is available", async () => {
    // Mock API to return only one kind of question
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        { id: "q1", entry_kind: "standard", question_label: "Standard Q" },
      ],
    })

    // Mock useRoleQuestions to return the question when entryKind is auto-set
    ;(useRoleQuestions as jest.Mock).mockReturnValue({
      questions: [{ key: "q1", label: "Standard Q", type: "text" }],
      isLoading: false,
    })

    await act(async () => {
      render(
        <EntryFormMultistep
          departmentId="dept-1"
          onSave={() => {}}
          onCancel={() => {}}
        />
      )
    })

    // Verify it skips straight to the form (e.g. shows the date step)
    await waitFor(() => {
      expect(screen.queryByText(/Select Report Type/i)).not.toBeInTheDocument()
      expect(screen.getByText(/Daily Log Entry/i)).toBeInTheDocument()
    })
  })
})
