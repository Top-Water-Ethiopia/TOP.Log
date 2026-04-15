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

// Render question keys that EntryFormMultistep decided are visible
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

jest.mock("@/components/entry-kind-dropdown", () => ({
  EntryKindDropdown: ({
    value,
    onChange,
  }: {
    value: string | null
    onChange: (value: string | null) => void
  }) => (
    <div>
      <div data-testid="selected-kind">{value}</div>
      <button type="button" onClick={() => onChange("standard")}>
        pick standard
      </button>
      <button type="button" onClick={() => onChange("agent_contact")}>
        pick agent_contact
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

describe("/logs/new grouping + conditional logic", () => {
  it("switches visible questions when entry kind changes (grouping by entry_kind)", async () => {
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
          agent_contact: [
            {
              id: "q-agent-1",
              key: "agent_name",
              label: "Agent name",
              type: "text",
              order: 0,
              required: false,
              entry_kind: "agent_contact",
            },
          ],
          standard: [
            {
              id: "q-std-1",
              key: "notes",
              label: "Notes",
              type: "text",
              order: 0,
              required: false,
              entry_kind: "standard",
            },
          ],
        }}
        initialAvailableEntryKinds={[
          { entry_kind: "agent_contact", is_default: true },
          { entry_kind: "standard", is_default: false },
        ]}
      />
    )

    await settleEffects()

    // Entry kind selector is shown on the date step
    expect(screen.getByTestId("selected-kind")).toHaveTextContent("agent_contact")

    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    await settleEffects()

    expect(screen.getByTestId("visible-question-keys")).toHaveTextContent("agent_name")

    // Switch entry kind on the date step
    fireEvent.click(screen.getByRole("button", { name: "Previous" }))
    await settleEffects()
    fireEvent.click(screen.getByRole("button", { name: "pick standard" }))
    await settleEffects()

    expect(screen.getByTestId("selected-kind")).toHaveTextContent("standard")

    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    await settleEffects()
    expect(screen.getByTestId("visible-question-keys")).toHaveTextContent("notes")
  })

  it("hides/shows questions based on conditional_logic within the selected entry kind", async () => {
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
        }}
        initialAvailableEntryKinds={[{ entry_kind: "standard", is_default: true }]}
      />
    )

    await settleEffects()

    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    await settleEffects()

    // Step 2 shows the controlling question.
    expect(screen.getByTestId("visible-question-keys")).toHaveTextContent("controls_visibility")

    // Make the dependent question visible.
    fireEvent.click(screen.getByRole("button", { name: "set controls_visibility=yes" }))
    await settleEffects()

    // Dependent question becomes visible in the same step group.
    expect(screen.getByTestId("visible-question-keys")).toHaveTextContent("visible_when_yes")

    // Now hide it again by going back and flipping the controlling value.
    fireEvent.click(screen.getByRole("button", { name: "set controls_visibility=no" }))
    await settleEffects()

    // Dependent question is hidden again, and navigation should go to preview next.
    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    await settleEffects()
    expect(screen.getByText("Review your responses before submitting")).toBeInTheDocument()
  })
})
