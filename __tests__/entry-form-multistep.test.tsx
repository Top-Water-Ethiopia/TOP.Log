import React from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
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
  QuickDateChips: ({
    options,
    onSelectDate,
  }: {
    options: Array<{ key: string; label: string; date: string }>
    onSelectDate: (date: string) => void
  }) => (
    <div data-testid="quick-date-chips">
      {options.map((option) => (
        <button key={option.key} type="button" onClick={() => onSelectDate(option.date)}>
          {option.label}
        </button>
      ))}
    </div>
  ),
}))

function createFetchResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  }
}

function setupFetch({
  entryAvailabilityId = null,
  assignedAgents = [],
}: {
  entryAvailabilityId?: string | null
  assignedAgents?: Array<Record<string, unknown>>
} = {}) {
  mockFetch.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes("/api/reporting/entry-availability")) {
      return Promise.resolve(
        createFetchResponse({
          data: {
            existingStandardEntryId: entryAvailabilityId,
          },
        })
      )
    }

    if (url.includes("/api/reporting/assigned-agents")) {
      return Promise.resolve(
        createFetchResponse({
          data: assignedAgents,
        })
      )
    }

    throw new Error(`Unexpected fetch URL: ${url}`)
  })
}

function renderForm(
  questions: Array<Record<string, unknown>>,
  options: {
    date?: string
    initialExistingStandardEntryId?: string | null
    stayOnAgentCallSave?: boolean
    onSave?: jest.Mock
    onCancel?: jest.Mock
    onDateChange?: jest.Mock
  } = {}
) {
  mockUseRoleQuestions.mockReturnValue({
    questions,
    isLoading: false,
    error: null,
  })

  const onSave = options.onSave || jest.fn()
  const onCancel = options.onCancel || jest.fn()
  const onDateChange = options.onDateChange || jest.fn()

  render(
    <EntryFormMultistep
      departmentId="dept-1"
      departmentName="Engineering"
      date={options.date || "2026-04-02"}
      initialExistingStandardEntryId={options.initialExistingStandardEntryId ?? null}
      stayOnAgentCallSave={options.stayOnAgentCallSave}
      onDateChange={onDateChange}
      onSave={onSave}
      onCancel={onCancel}
    />
  )

  return { onSave, onCancel, onDateChange }
}

async function settleAvailabilityEffect() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

async function waitForPrimaryButton(name: string | RegExp) {
  await waitFor(() => {
    expect(screen.getByRole("button", { name })).toBeEnabled()
  })
}

describe("EntryFormMultistep", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useRealTimers()
    window.localStorage.clear()
    global.fetch = mockFetch as unknown as typeof fetch
    setupFetch()
    jest.spyOn(window, "confirm").mockReturnValue(true)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("shows department context, category labels, and grouped preview sections", async () => {
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
    await settleAvailabilityEffect()

    expect(screen.getByText("Reporting for Engineering")).toBeInTheDocument()
    expect(screen.getByText("Department report included")).toBeInTheDocument()

    await waitForPrimaryButton("Continue")
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

  it("shows duplicate standard entry state and offers to open the existing report", async () => {
    setupFetch({ entryAvailabilityId: "entry-1" })

    renderForm(
      [
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
      ],
      {
        initialExistingStandardEntryId: "entry-1",
      }
    )
    await settleAvailabilityEffect()

    expect(screen.getByText("A standard report already exists for this date")).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Open Existing Report" })).toBeInTheDocument()
    })

    const openLink = screen.getByRole("link", { name: "Open Existing Report" })
    expect(openLink).toHaveAttribute("href", "/reports/entry-1")
  })

  it("shows an empty state and disables submission when no report questions are available", async () => {
    renderForm([])
    await settleAvailabilityEffect()

    await waitForPrimaryButton("Continue")
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))

    expect(screen.getByText("No Report Questions Available")).toBeInTheDocument()
    expect(screen.getByText(/No profession or department report questions are configured for Engineering\./)).toBeInTheDocument()

    const submitButton = screen.getByRole("button", { name: "No Questions Available" })
    expect(submitButton).toBeDisabled()
    expect(mockAddEntry).not.toHaveBeenCalled()
  })

  it("updates the selected date and notifies the route when a quick date button is pressed", async () => {
    const onDateChange = jest.fn()
    renderForm([], { onDateChange })
    await settleAvailabilityEffect()

    expect(screen.getByText("Thursday, April 2, 2026")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Apr 1" }))
    await settleAvailabilityEffect()

    expect(screen.getAllByText("Wednesday, April 1, 2026").length).toBeGreaterThan(0)
    expect(onDateChange).toHaveBeenCalledWith("2026-04-01")
  })

  it("does not notify the route when the same quick date is selected again", async () => {
    const onDateChange = jest.fn()
    renderForm([], { onDateChange })
    await settleAvailabilityEffect()

    fireEvent.click(screen.getByRole("button", { name: "Apr 2" }))

    expect(onDateChange).not.toHaveBeenCalled()
  })

  it("loads assigned agents, shows the selected agent context, and saves an agent-call entry", async () => {
    setupFetch({
      assignedAgents: [
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

    expect(screen.queryByText("Agent Two")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /Agent One/ }))

    expect(screen.getAllByText("Addis Ababa").length).toBeGreaterThan(0)
    expect(screen.getAllByText("+251912345678").length).toBeGreaterThan(0)

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

  it("keeps the user on the form after an agent-call save, refreshes availability, and clears the prior selection", async () => {
    setupFetch({
      assignedAgents: [
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
          alreadyReported: false,
        },
      ],
    })

    mockFetch.mockImplementationOnce((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/api/reporting/entry-availability")) {
        return Promise.resolve(createFetchResponse({ data: { existingStandardEntryId: null } }))
      }
      if (url.includes("/api/reporting/assigned-agents")) {
        return Promise.resolve(
          createFetchResponse({
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
                alreadyReported: false,
              },
            ],
          })
        )
      }
      throw new Error(`Unexpected fetch URL: ${url}`)
    })

    mockFetch.mockImplementationOnce((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/api/reporting/assigned-agents")) {
        return Promise.resolve(
          createFetchResponse({
            data: [
              {
                id: "agent-1",
                name: "Agent One",
                location: "Addis Ababa",
                phone: "+251912345678",
                alreadyReported: true,
              },
              {
                id: "agent-2",
                name: "Agent Two",
                location: "Adama",
                phone: "+251955555555",
                alreadyReported: false,
              },
            ],
          })
        )
      }
      return Promise.resolve(createFetchResponse({ data: { existingStandardEntryId: null } }))
    })

    const onSave = jest.fn()
    renderForm(
      [
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
      ],
      {
        onSave,
        stayOnAgentCallSave: true,
      }
    )

    fireEvent.click(screen.getByRole("button", { name: "Continue" }))

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Agent One/ })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: /Agent One/ }))
    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    fireEvent.click(screen.getByRole("button", { name: "Submit Log" }))

    await waitFor(() => {
      expect(screen.getByText("Ready for the next call report")).toBeInTheDocument()
    })

    expect(onSave).toHaveBeenCalledWith({ entryKind: "agent_call", date: "2026-04-02" })

    await waitFor(() => {
      expect(screen.queryByText("Addis Ababa")).not.toBeInTheDocument()
    })
  })

  it("blocks progress when no assigned agents remain for the selected date", async () => {
    setupFetch({
      assignedAgents: [
        {
          id: "agent-1",
          name: "Agent One",
          location: "Addis Ababa",
          phone: "+251912345678",
          alreadyReported: true,
        },
      ],
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
      expect(screen.getByText(/All assigned agents are already reported/i)).toBeInTheDocument()
    })

    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled()
    expect(mockAddEntry).not.toHaveBeenCalled()
  })

  it("warns before cancelling when there are unsaved changes", async () => {
    const onCancel = jest.fn()
    ;(window.confirm as jest.Mock).mockReturnValue(false)
    renderForm(
      [
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
      ],
      { onCancel }
    )
    await settleAvailabilityEffect()

    await waitForPrimaryButton("Continue")
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))

    expect(window.confirm).toHaveBeenCalledWith("You have unsaved changes. Leave this page?")
    expect(onCancel).not.toHaveBeenCalled()
  })

  it("restores the draft step and allows the current date draft to be discarded", async () => {
    jest.useFakeTimers()
    window.localStorage.setItem(
      "dailyLogDraft:v1:user-1:dept-1:2026-04-02",
      JSON.stringify({
        version: 1,
        savedAt: "2026-04-03T08:00:00.000Z",
        currentStep: 2,
        formData: {},
        customResponses: {},
      })
    )

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
    await settleAvailabilityEffect()

    expect(screen.getByText("Draft restored")).toBeInTheDocument()
    expect(screen.getByTestId("role-question-fields")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Discard Draft" }))

    expect(window.localStorage.getItem("dailyLogDraft:v1:user-1:dept-1:2026-04-02")).toBeNull()
    expect(screen.queryByText("Draft restored")).not.toBeInTheDocument()

    await waitForPrimaryButton("Continue")
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    act(() => {
      jest.advanceTimersByTime(5000)
    })

    expect(window.localStorage.getItem("dailyLogDraft:v1:user-1:dept-1:2026-04-02")).not.toBeNull()
  })

  it("does not autosave a draft until the user changes something", async () => {
    jest.useFakeTimers()
    renderForm([])
    await settleAvailabilityEffect()

    act(() => {
      jest.advanceTimersByTime(5000)
    })

    expect(window.localStorage.getItem("dailyLogDraft:v1:user-1:dept-1:2026-04-02")).toBeNull()
  })
})
