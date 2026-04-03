import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { EntryFormMultistep } from "@/components/entry-form-multistep"

const mockAddEntry = jest.fn()
const mockUseRoleQuestions = jest.fn()

jest.mock("@/contexts/supabase-log-context", () => ({
  useCaptainLog: () => ({
    addEntry: mockAddEntry,
  }),
}))

jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { id: "user-1", email: "user@example.com" },
  }),
}))

jest.mock("@/contexts/supabase-auth-context", () => ({
  useSupabaseAuth: () => ({
    user: { id: "user-1" },
  }),
}))

jest.mock("@/hooks/use-rbac", () => ({
  useRBAC: () => ({
    validateResponse: () => null,
    processResponses: (_questions: unknown, responses: unknown) => ({
      processedResponses: responses,
    }),
  }),
}))

jest.mock("@/hooks/use-role-questions", () => ({
  useRoleQuestions: (...args: unknown[]) => mockUseRoleQuestions(...args),
}))

jest.mock("@/components/role-based-question-fields", () => ({
  RoleBasedQuestionFields: () => <div data-testid="role-question-fields">Role question fields</div>,
}))

jest.mock("@/components/features/daily-log/molecules", () => ({
  DateRestrictionBanner: ({ title }: { title: string }) => <div data-testid="date-banner">{title}</div>,
  QuickDateChips: () => <div data-testid="quick-date-chips" />,
}))

function renderForm(questions: Array<Record<string, unknown>>) {
  mockUseRoleQuestions.mockReturnValue({
    questions,
    isLoading: false,
    error: null,
  })

  const onSave = jest.fn()
  const onCancel = jest.fn()

  render(
    <EntryFormMultistep
      departmentId="dept-1"
      departmentName="Engineering"
      date="2026-04-02"
      onSave={onSave}
      onCancel={onCancel}
    />
  )

  return { onSave, onCancel }
}

describe("EntryFormMultistep", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("shows department context, category labels, and grouped preview sections", () => {
    renderForm([
      {
        id: "department-question",
        key: "department-question",
        label: "Department status",
        title: "Department status",
        type: "textarea",
        category: "department_report",
        required: false,
        order: 1,
      },
      {
        id: "profession-question",
        key: "profession-question",
        label: "Implemented work",
        title: "Implemented work",
        type: "textarea",
        category: "profession_question",
        required: false,
        order: 2,
      },
    ])

    expect(screen.getByText("Reporting for Engineering")).toBeInTheDocument()
    expect(screen.getByText("Department report included")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    expect(screen.getByText("Department Report")).toBeInTheDocument()
    expect(screen.getAllByText("These answers represent the Engineering department.")).toHaveLength(2)

    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(screen.getByText("Profession Question")).toBeInTheDocument()
    expect(screen.getByText("These answers apply to your assigned profession in Engineering.")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(screen.getByText("Department Report Questions")).toBeInTheDocument()
    expect(screen.getByText("Profession Questions")).toBeInTheDocument()
    expect(screen.getByText("Department status")).toBeInTheDocument()
    expect(screen.getByText("Implemented work")).toBeInTheDocument()
  })

  it("hides the department report banner when there are no department report questions", () => {
    renderForm([
      {
        id: "profession-question",
        key: "profession-question",
        label: "Implemented work",
        title: "Implemented work",
        type: "textarea",
        category: "profession_question",
        required: false,
        order: 1,
      },
    ])

    expect(screen.queryByText("Department report included")).not.toBeInTheDocument()
    expect(screen.getByText("Reporting for Engineering")).toBeInTheDocument()
  })

  it("shows an empty state and disables submission when no report questions are available", () => {
    renderForm([])

    fireEvent.click(screen.getByRole("button", { name: "Continue" }))

    expect(screen.getByText("No Report Questions Available")).toBeInTheDocument()
    expect(screen.getByText(/No profession or department report questions are configured for Engineering\./)).toBeInTheDocument()

    const submitButton = screen.getByRole("button", { name: "No Questions Available" })
    expect(submitButton).toBeDisabled()
    expect(mockAddEntry).not.toHaveBeenCalled()
  })
})
