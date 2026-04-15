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

const mockUseRoleQuestions = jest.fn()
jest.mock("@/hooks/use-role-questions", () => ({
  useRoleQuestions: (...args: any[]) => mockUseRoleQuestions(...args),
}))

jest.mock("@/components/entry-kind-dropdown", () => ({
  EntryKindDropdown: ({ value }: { value: string | null }) => <div data-testid="selected-kind">{value}</div>,
}))

// Render question keys that EntryFormMultistep decided are visible.
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
      <button type="button" onClick={() => onChange("controls_visibility", "yes")}>
        set controls_visibility=yes
      </button>
      <button type="button" onClick={() => onChange("controls_visibility", "no")}>
        set controls_visibility=no
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

describe("/logs/new visibility logic with fetched questions", () => {
  it("re-evaluates conditional_logic when answers change (useRoleQuestions path)", async () => {
    mockUseRoleQuestions.mockReturnValue({
      questions: [
        {
          id: "q-ctrl",
          key: "controls_visibility",
          label: "Controls visibility?",
          type: "select",
          order: 0,
          required: false,
          entry_kind: "standard",
          step: 1,
        },
        {
          id: "q-dependent",
          key: "visible_when_yes",
          label: "Only when yes",
          type: "text",
          order: 1,
          required: false,
          entry_kind: "standard",
          step: 1,
          conditional_logic: {
            showIf: { questionKey: "controls_visibility", operator: "equals", value: "yes" },
          },
        },
      ],
      isLoading: false,
      error: null,
    })

    render(
      <EntryFormMultistep
        departmentId="dept-1"
        departmentName="Sales"
        date="2026-04-14"
        allowedDates={["2026-04-14"]}
        initialExistingEntryId={null}
        onSave={jest.fn()}
        onCancel={jest.fn()}
        initialRoleQuestions={undefined}
      />
    )

    await settleEffects()
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    await settleEffects()

    expect(screen.getByTestId("visible-question-keys")).toHaveTextContent("controls_visibility")
    expect(screen.getByTestId("visible-question-keys")).not.toHaveTextContent("visible_when_yes")

    fireEvent.click(screen.getByRole("button", { name: "set controls_visibility=yes" }))
    await settleEffects()
    expect(screen.getByTestId("visible-question-keys")).toHaveTextContent("visible_when_yes")

    fireEvent.click(screen.getByRole("button", { name: "set controls_visibility=no" }))
    await settleEffects()
    expect(screen.getByTestId("visible-question-keys")).not.toHaveTextContent("visible_when_yes")
  })
})

