import { renderHook, waitFor } from "@testing-library/react"
import { useRoleQuestions } from "@/hooks/use-role-questions"

const mockApiFetch = jest.fn()

jest.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  getErrorMessage: (err: unknown, fallback: string) => fallback,
}))

jest.mock("@/lib/reporting-model", () => ({
  getQuestionCategory: () => "department_report",
}))

jest.mock("@/lib/marketing-agents", () => ({
  getQuestionOptionSource: () => null,
}))

jest.mock("@/contexts/supabase-auth-context", () => ({
  useSupabaseAuth: () => ({
    user: { id: "user-1" },
    profile: { role_id: "role-1" },
  }),
}))

describe("useRoleQuestions - entry_kind filtering", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("should fetch questions without entryKind when not provided", async () => {
    mockApiFetch.mockResolvedValue([])

    renderHook(() => useRoleQuestions(undefined, "dept-1", null))

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalled()
    })

    const callArgs = mockApiFetch.mock.calls[0]
    const url = callArgs[0] as string

    expect(url).toContain("departmentId=dept-1")
    expect(url).not.toContain("entryKind")
  })

  it("should fetch questions filtered by entry_kind when provided", async () => {
    mockApiFetch.mockResolvedValue([
      {
        id: "q-1",
        question_key: "sales-call",
        question_label: "How many sales calls?",
        question_type: "number",
        entry_kind: "sales",
        is_required: true,
        display_order: 1,
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
      },
    ])

    renderHook(() => useRoleQuestions(undefined, "dept-1", "sales"))

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalled()
    })

    const callArgs = mockApiFetch.mock.calls[0]
    const url = callArgs[0] as string

    expect(url).toContain("departmentId=dept-1")
    expect(url).toContain("entryKind=sales")
  })

  it("should include the profession role when provided", async () => {
    mockApiFetch.mockResolvedValue([])

    renderHook(() => useRoleQuestions(undefined, "dept-1", null, "sales-promoter"))

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalled()
    })

    const callArgs = mockApiFetch.mock.calls[0]
    const url = callArgs[0] as string

    expect(url).toContain("departmentId=dept-1")
    expect(url).toContain("role=sales-promoter")
  })

  it("should refetch when entryKind changes", async () => {
    mockApiFetch.mockResolvedValue([])

    const { rerender } = renderHook(
      ({ entryKind }) => useRoleQuestions(undefined, "dept-1", entryKind),
      { initialProps: { entryKind: "standard" as string | null } }
    )

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledTimes(1)
    })

    const firstCall = mockApiFetch.mock.calls[0][0] as string
    expect(firstCall).toContain("entryKind=standard")

    mockApiFetch.mockClear()
    mockApiFetch.mockResolvedValue([])
    rerender({ entryKind: "agent_call" })

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledTimes(1)
    })

    const secondCall = mockApiFetch.mock.calls[0][0] as string
    expect(secondCall).toContain("entryKind=agent_call")
  })

  it("should return formatted questions", async () => {
    mockApiFetch.mockResolvedValue([
      {
        id: "q-1",
        question_key: "mood",
        question_label: "How was your day?",
        question_type: "rating",
        question_description: "Rate your day",
        entry_kind: "daily",
        is_required: true,
        display_order: 1,
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
        metadata: null,
      },
    ])

    const { result } = renderHook(() => useRoleQuestions(undefined, "dept-1", "daily"))

    await waitFor(() => {
      expect(result.current.questions.length).toBe(1)
    })

    const question = result.current.questions[0]
    expect(question.key).toBe("mood")
    expect(question.label).toBe("How was your day?")
    expect(question.type).toBe("rating")
    expect(question.category).toBe("department_report")
  })
})
