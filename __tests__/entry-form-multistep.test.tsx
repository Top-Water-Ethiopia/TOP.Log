import React from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { EntryFormMultistep } from "@/components/entry-form-multistep"

const mockAddEntry = jest.fn()
const mockUseRoleQuestions = jest.fn()
const mockFetch = jest.fn()
const mockImageAsset = {
  provider: "cloudinary" as const,
  resourceType: "image" as const,
  publicId: "captain-log/reports/sample-image",
  secureUrl: "https://res.cloudinary.com/demo/image/upload/sample-image.jpg",
  originalFilename: "sample-image.jpg",
  bytes: 1024,
  format: "jpg",
  uploadedByDisplayName: "Sam Reporter",
  uploadedAt: "2026-04-10T14:25:00Z",
}

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
  RoleBasedQuestionFields: ({
    questions,
    onChange,
    onUploadPendingStateChange,
  }: {
    questions: Array<{ key: string; type: string; metadata?: { testPendingOnMount?: boolean } | null }>
    onChange: (questionKey: string, value: unknown) => void
    onUploadPendingStateChange?: (questionKey: string, hasBlockingUploads: boolean) => void
  }) => {
    const question = questions[0]

    React.useEffect(() => {
      if (question?.metadata?.testPendingOnMount) {
        onUploadPendingStateChange?.(question.key, true)
      }

      return () => {
        if (question) {
          onUploadPendingStateChange?.(question.key, false)
        }
      }
    }, [onUploadPendingStateChange, question])

    return (
      <div data-testid="role-question-fields">
        Role question fields
        {question ? (
          <div>
            <button type="button" onClick={() => onChange(question.key, "Preview text response")}>
              set text response
            </button>
            {question.type === "image" ? (
              <>
                <button type="button" onClick={() => onChange(question.key, [mockImageAsset])}>
                  set image response
                </button>
                <button type="button" onClick={() => onUploadPendingStateChange?.(question.key, true)}>
                  set pending upload
                </button>
                <button type="button" onClick={() => onUploadPendingStateChange?.(question.key, false)}>
                  clear pending upload
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    )
  },
}))

jest.mock("@/components/entry-kind-dropdown", () => ({
  EntryKindDropdown: ({
    value,
    onChange,
    label,
  }: {
    value: string | null
    onChange: (value: string | null) => void
    label?: string
  }) => (
    <div data-testid="entry-kind-dropdown">
      <span>{label || "Report Type"}</span>
      <span data-testid="selected-entry-kind">{value || "none"}</span>
      <button type="button" onClick={() => onChange("standard")}>
        select standard
      </button>
      <button type="button" onClick={() => onChange("major_activity")}>
        select major activity
      </button>
      <button type="button" onClick={() => onChange("agent_call")}>
        select agent call
      </button>
    </div>
  ),
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
  allowMultiplePerDay = false,
  assignedAgents = [],
  usageByQuestion = {},
}: {
  entryAvailabilityId?: string | null
  allowMultiplePerDay?: boolean
  assignedAgents?: Array<Record<string, unknown>>
  usageByQuestion?: Record<string, Record<string, number>>
} = {}) {
  mockFetch.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes("/api/reporting/entry-availability")) {
      return Promise.resolve(
        createFetchResponse({
          data: {
            existingEntryId: entryAvailabilityId,
            existingStandardEntryId: entryAvailabilityId,
            allowMultiplePerDay,
          },
        })
      )
    }

    if (url.includes("/api/reporting/assigned-agents")) {
      return Promise.resolve(
        createFetchResponse({
          data: assignedAgents,
          usageByQuestion,
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
    initialExistingEntryId?: string | null
    stayOnAgentCallSave?: boolean
    onSave?: jest.Mock
    onCancel?: jest.Mock
    onDateChange?: jest.Mock
    role?: string | null
    initialQuestionsByKind?: Record<string, Array<Record<string, unknown>>>
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
      allowedDates={["2026-04-01", "2026-04-02", "2026-04-08"]}
      initialExistingEntryId={options.initialExistingEntryId ?? null}
      stayOnAgentCallSave={options.stayOnAgentCallSave}
      onDateChange={onDateChange}
      onSave={onSave}
      onCancel={onCancel}
      role={options.role}
      initialQuestionsByKind={options.initialQuestionsByKind}
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
        initialExistingEntryId: "entry-1",
      }
    )
    await settleAvailabilityEffect()

    expect(screen.getByText("A report for this type already exists on this date")).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Open Existing Report" })).toBeInTheDocument()
    })

    const openLink = screen.getByRole("link", { name: "Open Existing Report" })
    expect(openLink).toHaveAttribute("href", "/reports/entry-1")
  })

  it("renders uploaded image previews in the preview step while leaving non-image answers as text", async () => {
    renderForm([
      {
        id: "image-question",
        key: "store-photo",
        label: "Store photo",
        title: "Store photo",
        type: "image",
        category: "profession_question",
        required: false,
        order: 1,
      },
      {
        id: "notes-question",
        key: "notes",
        label: "Notes",
        title: "Notes",
        type: "textarea",
        category: "profession_question",
        required: false,
        order: 2,
      },
    ])

    await waitForPrimaryButton("Continue")
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))

    fireEvent.click(screen.getByRole("button", { name: "set image response" }))
    fireEvent.click(screen.getByRole("button", { name: "Next" }))

    fireEvent.click(screen.getByRole("button", { name: "set text response" }))
    fireEvent.click(screen.getByRole("button", { name: "Next" }))

    const imageLinks = screen.getAllByRole("link", { name: "sample-image.jpg" })
    expect(imageLinks[0]).toHaveAttribute("href", mockImageAsset.secureUrl)
    expect(imageLinks[0]).toHaveAttribute("target", "_blank")
    expect(imageLinks[0]).toHaveAttribute("rel", expect.stringContaining("noopener"))
    expect(screen.getByAltText("sample-image.jpg")).toBeInTheDocument()
    expect(screen.getByText(/Uploaded by Sam Reporter/)).toBeInTheDocument()
    expect(screen.getByText("Preview text response")).toBeInTheDocument()
  })

  it("allows another same-day entry when the selected report type is recurring", async () => {
    setupFetch({ entryAvailabilityId: "entry-1", allowMultiplePerDay: true })

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
        initialExistingEntryId: "entry-1",
      }
    )
    await settleAvailabilityEffect()

    expect(screen.queryByText("A report for this type already exists on this date")).not.toBeInTheDocument()
    await waitForPrimaryButton("Continue")
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

    expect(screen.getAllByText("Thursday, April 2, 2026").length).toBeGreaterThan(0)

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
          alreadyReported: false,
        },
      ],
      usageByQuestion: {
        "agent-contact": {
          "agent-2": 1,
        },
      },
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
        maxLogsPerAgentPerDay: 1,
      },
    ])

    await waitForPrimaryButton("Continue")
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Agent One/ })).toBeInTheDocument()
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
          entry_kind: "standard",
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

  it("loads assigned agents for multiselect questions and saves the selected ids", async () => {
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

    renderForm([
      {
        id: "agents-question",
        key: "agents-contacted",
        label: "Agents contacted",
        title: "Agents contacted",
        type: "multiselect",
        category: "profession_question",
        required: true,
        order: 1,
        optionSourceKind: "assigned_agents",
      },
    ])

    await waitForPrimaryButton("Continue")
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))

    await waitFor(() => {
      expect(screen.getByText("Agent One")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText("Agent One"))
    fireEvent.click(screen.getByText("Agent Two"))

    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    fireEvent.click(screen.getByRole("button", { name: "Submit Log" }))

    await waitFor(() => {
      expect(mockAddEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          department_id: "dept-1",
          entry_kind: "standard",
          customResponses: [
            expect.objectContaining({
              questionKey: "agents-contacted",
              value: ["agent-1", "agent-2"],
            }),
          ],
        })
      )
    })
  })

  it("preserves a custom entry kind when a single assigned agent is selected", async () => {
    setupFetch({
      assignedAgents: [
        {
          id: "agent-1",
          name: "Agent One",
          location: "Addis Ababa",
          phone: "+251912345678",
          alreadyReported: false,
        },
      ],
    })

    renderForm([], {
      role: "sales-promoter",
      initialQuestionsByKind: {
        standard: [
          {
            id: "standard-question",
            question_key: "standard-question",
            question_label: "Standard question",
            question_type: "textarea",
            category: "profession_question",
            is_required: false,
            display_order: 1,
            metadata: null,
          },
        ],
        major_activity: [
          {
            id: "agent-question",
            question_key: "agent-contact",
            question_label: "Agent contacted",
            question_type: "select",
            category: "profession_question",
            is_required: true,
            display_order: 1,
            metadata: {
              option_source: {
                kind: "assigned_agents",
                max_logs_per_agent_per_day: 1,
              },
            },
          },
        ],
      },
    })

    await settleAvailabilityEffect()

    fireEvent.click(screen.getByRole("button", { name: "select major activity" }))
    await waitForPrimaryButton("Continue")
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))

    await waitFor(() => {
      expect(screen.getByText("Agent One")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: /Agent One/ }))
    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    fireEvent.click(screen.getByRole("button", { name: "Submit Log" }))

    await waitFor(() => {
      expect(mockAddEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          department_id: "dept-1",
          entry_kind: "major_activity",
          subject_agent_id: "agent-1",
          subject_agent_snapshot: {
            name: "Agent One",
            location: "Addis Ababa",
            phone: "+251912345678",
          },
        })
      )
    })
  })

  it("defaults to standard and still lets the user switch to a custom report kind", async () => {
    renderForm([], {
      role: "sales-promoter",
      initialQuestionsByKind: {
        standard: [
          {
            id: "standard-question",
            question_key: "standard-question",
            question_label: "Standard question",
            question_type: "textarea",
            category: "profession_question",
            is_required: false,
            display_order: 1,
            metadata: null,
          },
        ],
        major_activity: [
          {
            id: "major-activity-question",
            question_key: "major-activity-question",
            question_label: "Major activity question",
            question_type: "textarea",
            category: "profession_question",
            is_required: false,
            display_order: 1,
            metadata: null,
          },
        ],
      },
    })
    await settleAvailabilityEffect()

    expect(screen.getByText("Report Type")).toBeInTheDocument()
    expect(screen.getByTestId("selected-entry-kind")).toHaveTextContent("standard")

    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    expect(screen.getByText("Standard question")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Previous" }))

    fireEvent.click(screen.getByRole("button", { name: "select major activity" }))
    expect(screen.getByTestId("selected-entry-kind")).toHaveTextContent("major_activity")

    await waitForPrimaryButton("Continue")
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    await waitFor(() => {
      expect(screen.getByText("Major activity question")).toBeInTheDocument()
    })
  })

  it("treats standard as selected by default when it is shown as the default report type", async () => {
    renderForm([], {
      role: "sales-promoter",
      initialQuestionsByKind: {
        standard: [
          {
            id: "standard-question",
            question_key: "standard-question",
            question_label: "Standard question",
            question_type: "textarea",
            category: "profession_question",
            is_required: false,
            display_order: 1,
            metadata: null,
          },
        ],
        major_activity: [
          {
            id: "major-activity-question",
            question_key: "major-activity-question",
            question_label: "Major activity question",
            question_type: "textarea",
            category: "profession_question",
            is_required: false,
            display_order: 1,
            metadata: null,
          },
        ],
      },
    })
    await settleAvailabilityEffect()

    expect(screen.getByTestId("selected-entry-kind")).toHaveTextContent("standard")

    fireEvent.click(screen.getByRole("button", { name: "Continue" }))

    expect(screen.getByText("Standard question")).toBeInTheDocument()
    expect(screen.queryByText("Select a report type to continue")).not.toBeInTheDocument()
  })

  it("submits the selected custom report kind instead of forcing standard", async () => {
    renderForm([], {
      initialQuestionsByKind: {
        major_activity: [
          {
            id: "major-activity-question",
            question_key: "major-activity-question",
            question_label: "Major activity question",
            question_type: "textarea",
            category: "profession_question",
            is_required: false,
            display_order: 1,
            metadata: null,
          },
        ],
      },
    })
    await settleAvailabilityEffect()

    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    expect(screen.getByText("Major activity question")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    fireEvent.click(screen.getByRole("button", { name: "Submit Log" }))

    await waitFor(() => {
      expect(mockAddEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          department_id: "dept-1",
          entry_kind: "major_activity",
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
        return Promise.resolve(
          createFetchResponse({ data: { existingEntryId: null, existingStandardEntryId: null, allowMultiplePerDay: false } })
        )
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
            usageByQuestion: {},
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
            usageByQuestion: {
              "agent-contact": {
                "agent-1": 1,
              },
            },
          })
        )
      }
      return Promise.resolve(
        createFetchResponse({ data: { existingEntryId: null, existingStandardEntryId: null, allowMultiplePerDay: false } })
      )
    })

    const onSave = jest.fn()
    renderForm([], {
      onSave,
      stayOnAgentCallSave: true,
      initialQuestionsByKind: {
        agent_call: [
          {
            id: "agent-question",
            question_key: "agent-contact",
            question_label: "Agent contacted",
            question_type: "select",
            category: "profession_question",
            is_required: true,
            display_order: 1,
            metadata: {
              option_source: {
                kind: "assigned_agents",
              },
            },
          },
        ],
      },
    })

    fireEvent.click(screen.getByRole("button", { name: "select agent call" }))

    await waitForPrimaryButton("Continue")
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

    expect(screen.getByRole("button", { name: /Agent One/ })).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByRole("button", { name: /Agent Two/ })).toBeInTheDocument()
  })

  it("blocks progress when no assigned agents remain for the selected date", async () => {
    setupFetch({
      assignedAgents: [
        {
          id: "agent-1",
          name: "Agent One",
          location: "Addis Ababa",
          phone: "+251912345678",
          alreadyReported: false,
        },
      ],
      usageByQuestion: {
        "agent-contact": {
          "agent-1": 1,
        },
      },
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
        maxLogsPerAgentPerDay: 1,
      },
    ])

    await waitForPrimaryButton("Continue")
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))

    await waitFor(() => {
      expect(screen.getByText("All assigned agents have reached this field's daily limit of 1.")).toBeInTheDocument()
    })

    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled()
    expect(mockAddEntry).not.toHaveBeenCalled()
  })

  it("disables next while image uploads are pending and removes the helper when they clear", async () => {
    renderForm([
      {
        id: "image-question",
        key: "store-photo",
        label: "Store photo",
        title: "Store photo",
        type: "image",
        category: "profession_question",
        required: false,
        order: 1,
        metadata: { testPendingOnMount: true },
      },
      {
        id: "notes-question",
        key: "notes",
        label: "Notes",
        title: "Notes",
        type: "textarea",
        category: "profession_question",
        required: false,
        order: 2,
      },
    ])

    await waitForPrimaryButton("Continue")
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))

    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled()
    expect(screen.getByText("Finish uploading all images before continuing.")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Previous" }))
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled()

    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    fireEvent.click(screen.getByRole("button", { name: "clear pending upload" }))

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Next" })).toBeEnabled()
    })

    expect(screen.queryByText("Finish uploading all images before continuing.")).not.toBeInTheDocument()
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
        schemaVersion: 1,
        savedAt: "2026-04-03T08:00:00.000Z",
        entryKind: "standard",
        questionIds: ["profession-question"],
        selectedDate: "2026-04-02",
        departmentId: "dept-1",
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
