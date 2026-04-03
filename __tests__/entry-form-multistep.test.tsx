import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { EntryFormMultistep } from "@/components/entry-form-multistep"

const mockAddEntry = jest.fn()
const mockUseRoleQuestions = jest.fn()
const mockFetch = jest.fn()

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
    processResponses: (questions: unknown, responses: unknown) => ({
      processedResponses: ((questions as Array<Record<string, unknown>>) || []).map((question) => ({
        questionId: question.id,
        questionKey: question.key,
        questionLabel: question.label,
        questionType: question.type,
        questionCategory: question.category,
        value: (responses as Record<string, unknown>)[String(question.key)],
      })),
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

jest.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    onValueChange,
    value,
  }: {
    children: React.ReactNode
    onValueChange: (value: string) => void
    value?: string
  }) => (
    <select aria-label="Select input" value={value ?? ""} onChange={(event) => onValueChange(event.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <option value="">{placeholder || "Select"}</option>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({
    children,
    disabled,
    value,
  }: {
    children: React.ReactNode
    disabled?: boolean
    value: string
  }) => (
    <option value={value} disabled={disabled}>
      {children}
    </option>
  ),
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
    global.fetch = mockFetch as unknown as typeof fetch
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    })
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

  it("loads assigned agents, shows the selected agent context, and saves an agent-call entry", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "agent-1",
            name: "Agent One",
            location: "Addis Ababa",
            phone: "+251912345678",
            alreadyReported: false,
          },
          {
            id: "agent-2",
            name: "Agent Two",
            location: "Adama",
            phone: "+251955555555",
            alreadyReported: true,
          },
        ],
      }),
    })

    renderForm([
      {
        id: "agent-question",
        key: "agent-contact",
        label: "Agent contacted",
        title: "Agent contacted",
        type: "select",
        category: "profession_question",
        required: true,
        order: 1,
        optionSourceKind: "assigned_agents",
      },
    ])

    fireEvent.click(screen.getByRole("button", { name: "Continue" }))

    await waitFor(() => {
      expect(screen.getByText("1 of 2 already reported today")).toBeInTheDocument()
    })

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "agent-1" },
    })

    expect(screen.getByText("Addis Ababa")).toBeInTheDocument()
    expect(screen.getByText("+251912345678")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    fireEvent.click(screen.getByRole("button", { name: "Submit Log" }))

    await waitFor(() => {
      expect(mockAddEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          department_id: "dept-1",
          entry_kind: "agent_call",
          subject_agent_id: "agent-1",
          subject_agent_snapshot: {
            name: "Agent One",
            location: "Addis Ababa",
            phone: "+251912345678",
          },
          customResponses: [
            expect.objectContaining({
              questionKey: "agent-contact",
              value: {
                value: "agent-1",
                label: "Agent One",
              },
            }),
          ],
        })
      )
    })
  })

  it("blocks progress when no assigned agents remain for the selected date", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "agent-1",
            name: "Agent One",
            location: "Addis Ababa",
            phone: "+251912345678",
            alreadyReported: true,
          },
        ],
      }),
    })

    renderForm([
      {
        id: "agent-question",
        key: "agent-contact",
        label: "Agent contacted",
        title: "Agent contacted",
        type: "select",
        category: "profession_question",
        required: true,
        order: 1,
        optionSourceKind: "assigned_agents",
      },
    ])

    fireEvent.click(screen.getByRole("button", { name: "Continue" }))

    await waitFor(() => {
      expect(screen.getByText("No agents available for this date")).toBeInTheDocument()
    })

    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled()
    expect(mockAddEntry).not.toHaveBeenCalled()
  })
})
