import React from "react"
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react"
import { EntryFormMultistep } from "@/components/entry-form-multistep"
import { evaluateConditionalLogic } from "@/lib/reporting-logic"

const mockFetch = jest.fn()
global.fetch = mockFetch as any

// Mock dependencies
jest.mock("@/contexts/supabase-log-context", () => ({
  useCaptainLog: () => ({ addEntry: jest.fn() }),
}))

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
}))

jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { id: "user-1", email: "user@example.com" },
  }),
}))

jest.mock("@/contexts/supabase-auth-context", () => ({
  useSupabaseAuth: () => ({ user: { id: "user-1" } }),
}))

jest.mock("@/hooks/use-rbac", () => ({
  useRBAC: () => ({
    validateResponse: () => null,
    processResponses: (questions: any[], responses: any) => ({
      processedResponses: questions.map((q) => ({
        questionId: q.id,
        questionKey: q.key,
        value: responses[q.key],
      })),
    }),
  }),
}))

jest.mock("@/hooks/use-role-questions", () => ({
  useRoleQuestions: (initialQuestions: any) => ({
    questions: initialQuestions || [],
    isLoading: false,
    error: null,
  }),
}))

jest.mock("swr", () => ({
  __esModule: true,
  default: () => ({
    data: null,
    error: null,
    isLoading: false,
  }),
}))

jest.mock("@/lib/reporting-logic", () => ({
  evaluateConditionalLogic: jest.fn(),
}))

const mockEvaluate = evaluateConditionalLogic as jest.Mock

describe("EntryFormMultistep - Grouping and Conditional Logic", () => {
  const mockOnSave = jest.fn()
  const mockOnCancel = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockEvaluate.mockReturnValue(true) // Show by default
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/reporting/entry-availability")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: { existingEntryId: null } }),
        })
      }
      if (url.includes("/api/reporting/assigned-agents")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [] }),
        })
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: [] }),
      })
    })
  })

  const questions = [
    {
      id: "q1",
      key: "found_agent",
      label: "Have you found the agent?",
      type: "radio",
      step: 1,
      order: 1,
      required: false,
    },
    {
      id: "q2",
      key: "conversation_time",
      label: "How long have you spoken?",
      type: "number",
      step: 2,
      order: 1,
      required: false,
      metadata: { section_label: "Success Details" },
      conditional_logic: { showIf: { questionKey: "found_agent", operator: "equals", value: "Yes" } },
    },
    {
      id: "q3",
      key: "attempts",
      label: "How many attempts?",
      type: "number",
      step: 2,
      order: 2,
      required: false,
      metadata: { section_label: "Attempt Details" },
      conditional_logic: { showIf: { questionKey: "found_agent", operator: "equals", value: "No" } },
    },
  ]

  async function moveToStep2() {
    await waitFor(() => {
      const continueBtn = screen.getByRole("button", { name: /Continue/i })
      expect(continueBtn).toBeEnabled()
      fireEvent.click(continueBtn)
    })
    // Now on Step 1 Questions (Form Step 2)
    await waitFor(() => expect(screen.getByText("Next")).toBeInTheDocument())
  }

  it("renders questions grouped in the same step with section headers", async () => {
    // Both q2 and q3 are in step 2. Mock evaluate returns true for all.
    mockEvaluate.mockReturnValue(true)

    render(
      <EntryFormMultistep
        departmentId="dept-1"
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        initialRoleQuestions={questions}
      />
    )

    await moveToStep2()
    
    // Step 1 Questions (Step 2 of form)
    expect(screen.getByText("Have you found the agent?")).toBeInTheDocument()
    
    // Switch to Next step (Step 3 of form)
    fireEvent.click(screen.getByRole("button", { name: /Next/i }))

    // Step 2 Questions: Both questions should be rendered because mockEvaluate returns true
    expect(screen.getByText("How long have you spoken?")).toBeInTheDocument()
    // Using a more flexible matcher for "How many attempts?" to avoid text breaking issues
    expect(screen.getByText(/How many attempts/i)).toBeInTheDocument()

    // Section headers should be visible
    expect(screen.getByText("Success Details")).toBeInTheDocument()
    expect(screen.getByText("Attempt Details")).toBeInTheDocument()
  })

  it("applies conditional logic to hide questions", async () => {
    // Initially q2 is visible, q3 is hidden
    mockEvaluate.mockImplementation((logic) => {
      if (logic?.showIf?.value === "No") return false
      return true
    })
    // Also need to return true for q1 which has NO logic in this test case usually,
    // but in case it's checked:
    mockEvaluate.mockReturnValueOnce(true) 

    render(
      <EntryFormMultistep
        departmentId="dept-1"
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        initialRoleQuestions={questions}
      />
    )

    await moveToStep2()
    fireEvent.click(screen.getByRole("button", { name: /Next/i }))

    // q2 should be visible
    expect(screen.getByText("How long have you spoken?")).toBeInTheDocument()
    expect(screen.getByText("Success Details")).toBeInTheDocument()

    // q3 should be HIDDEN
    expect(screen.queryByText("How many attempts?")).not.toBeInTheDocument()
    expect(screen.queryByText("Attempt Details")).not.toBeInTheDocument()
  })

  it("skips steps when all questions are hidden", async () => {
    // Hide ALL questions in step 2 (Attempts/Time)
    mockEvaluate.mockImplementation((logic) => {
      if (logic?.showIf?.questionKey === "found_agent") return false
      return true
    })

    render(
      <EntryFormMultistep
        departmentId="dept-1"
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        initialRoleQuestions={questions}
      />
    )

    await moveToStep2()
    
    // On Question Step 1 (found_agent)
    expect(screen.getByText("Have you found the agent?")).toBeInTheDocument()
    
    // When clicking Next, it should skip Step 2 (empty) and go to Step 3 (Preview)
    fireEvent.click(screen.getByRole("button", { name: /Next/i }))

    await waitFor(() => {
      expect(screen.getByText("Review your responses before submitting")).toBeInTheDocument()
    })

    // Should NOT show step 2 content
    expect(screen.queryByText("How long have you spoken?")).not.toBeInTheDocument()
    expect(screen.queryByText("Success Details")).not.toBeInTheDocument()
  })
})
