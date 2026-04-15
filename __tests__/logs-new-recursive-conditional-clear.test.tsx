import React from "react"
import { act, render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"

import { EntryFormMultistep } from "@/components/entry-form-multistep"

const mockFetch = jest.fn()

jest.mock("@/contexts/supabase-log-context", () => ({
  useCaptainLog: () => ({
    addEntry: jest.fn(),
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
    processResponses: () => ({ processedResponses: [] }),
  }),
}))

jest.mock("@/hooks/use-role-questions", () => ({
  useRoleQuestions: () => ({ questions: [], isLoading: false, error: null }),
}))

jest.mock("@/components/entry-kind-dropdown", () => ({
  EntryKindDropdown: ({
    value,
  }: {
    value: string | null
    onChange: (value: string | null) => void
  }) => <div data-testid="selected-kind">{value}</div>,
}))

// Render visible question keys; provide buttons to set values for conditional chain.
jest.mock("@/components/role-based-question-fields", () => ({
  RoleBasedQuestionFields: ({
    questions,
    onChange,
  }: {
    questions: Array<{ key: string }>
    onChange: (questionKey: string, value: unknown) => void
  }) => (
    <div>
      <div data-testid="visible-question-keys">{questions.map((q) => q.key).join(",")}</div>
      <button type="button" onClick={() => onChange("q1", "yes")}>
        set q1=yes
      </button>
      <button type="button" onClick={() => onChange("q1", "no")}>
        set q1=no
      </button>
      <button type="button" onClick={() => onChange("q2", "yes")}>
        set q2=yes
      </button>
      <button type="button" onClick={() => onChange("q2", "no")}>
        set q2=no
      </button>
    </div>
  ),
}))

beforeAll(() => {
  // @ts-expect-error - test shim
  global.fetch = (...args: any[]) => mockFetch(...args)
})

beforeEach(() => {
  jest.clearAllMocks()
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      data: { existingEntryId: null, existingStandardEntryId: null, allowMultiplePerDay: false },
    }),
  })
})

async function settleEffects() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe("/logs/new recursive conditional clearing", () => {
  it("clears hidden answers and recursively hides dependents", async () => {
    render(
      <EntryFormMultistep
        departmentId="dept-1"
        departmentName="Sales"
        date="2026-04-14"
        allowedDates={["2026-04-14"]}
        initialExistingEntryId={null}
        onSave={jest.fn()}
        onCancel={jest.fn()}
        initialQuestionsByKind={{
          standard: [
            {
              id: "q1",
              key: "q1",
              label: "Controls Q2",
              type: "select",
              order: 0,
              required: false,
              entry_kind: "standard",
              step: 1,
            },
            {
              id: "q2",
              key: "q2",
              label: "Depends on Q1",
              type: "select",
              order: 1,
              required: false,
              entry_kind: "standard",
              step: 2,
              conditional_logic: { showIf: { questionKey: "q1", operator: "equals", value: "yes" } },
            },
            {
              id: "q3",
              key: "q3",
              label: "Depends on Q2",
              type: "text",
              order: 2,
              required: false,
              entry_kind: "standard",
              step: 3,
              conditional_logic: { showIf: { questionKey: "q2", operator: "equals", value: "yes" } },
            },
          ],
        }}
        initialAvailableEntryKinds={[{ entry_kind: "standard", is_default: true }]}
      />
    )

    await settleEffects()

    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    await settleEffects()
    expect(screen.getByTestId("visible-question-keys")).toHaveTextContent("q1")

    // Make Q2 visible.
    fireEvent.click(screen.getByRole("button", { name: "set q1=yes" }))
    await settleEffects()

    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    await settleEffects()
    expect(screen.getByTestId("visible-question-keys")).toHaveTextContent("q2")

    // Make Q3 visible.
    fireEvent.click(screen.getByRole("button", { name: "set q2=yes" }))
    await settleEffects()
    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    await settleEffects()
    expect(screen.getByTestId("visible-question-keys")).toHaveTextContent("q3")

    // Go back to Q1 and hide Q2. This should clear Q2 and recursively hide Q3, skipping to preview.
    fireEvent.click(screen.getByRole("button", { name: "Previous" }))
    await settleEffects()
    fireEvent.click(screen.getByRole("button", { name: "Previous" }))
    await settleEffects()
    expect(screen.getByTestId("visible-question-keys")).toHaveTextContent("q1")

    fireEvent.click(screen.getByRole("button", { name: "set q1=no" }))
    await settleEffects()

    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    await settleEffects()

    expect(screen.getByText("Review your responses before submitting")).toBeInTheDocument()
    expect(screen.queryByTestId("visible-question-keys")).toBeNull()
  })
})
