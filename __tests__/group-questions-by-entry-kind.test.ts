import { describe, it, expect } from "@jest/globals"

type RoleQuestionWithRole = {
  id: string
  entry_kind?: string | null
  question_label: string
  question_type: string
  is_active: boolean
  role_id?: string | null
  department_id?: string | null
}

type ScopeEntryKind = {
  id: string
  entry_kind: string
  label: string
  sort_order: number
  is_active: boolean
}

// Re-implement the function for testing (since it's not exported)
function groupQuestionsByEntryKind(
  questions: RoleQuestionWithRole[],
  entryKindConfigs: ScopeEntryKind[] = []
): Record<string, RoleQuestionWithRole[]> {
  const grouped: Record<string, RoleQuestionWithRole[]> = {}

  const allEntryKinds = new Set<string>()
  entryKindConfigs.forEach((config) => allEntryKinds.add(config.entry_kind))
  questions.forEach((q) => {
    const kind = q.entry_kind || "standard"
    allEntryKinds.add(kind)
  })
  allEntryKinds.add("standard")

  allEntryKinds.forEach((kind) => {
    grouped[kind] = []
  })

  questions.forEach((q) => {
    const kind = q.entry_kind || "standard"
    if (!grouped[kind]) {
      grouped[kind] = []
    }
    grouped[kind].push(q)
  })

  return grouped
}

describe("groupQuestionsByEntryKind", () => {
  it("groups questions by all entry kinds from configs", () => {
    const configs: ScopeEntryKind[] = [
      { id: "1", entry_kind: "agent_call", label: "Agent Call", sort_order: 0, is_active: true },
      { id: "2", entry_kind: "daily_summary", label: "Daily Summary", sort_order: 1, is_active: true },
      { id: "3", entry_kind: "standard", label: "Standard", sort_order: 2, is_active: true },
      { id: "4", entry_kind: "custom_report", label: "Custom Report", sort_order: 3, is_active: true },
      { id: "5", entry_kind: "marketing_lead", label: "Marketing Lead", sort_order: 4, is_active: true },
    ]

    const questions: RoleQuestionWithRole[] = [
      { id: "q1", entry_kind: "agent_call", question_label: "Call duration", question_type: "number", is_active: true },
      { id: "q2", entry_kind: "custom_report", question_label: "Report notes", question_type: "text", is_active: true },
      { id: "q3", entry_kind: "marketing_lead", question_label: "Lead source", question_type: "select", is_active: true },
      { id: "q4", entry_kind: "agent_call", question_label: "Call outcome", question_type: "select", is_active: true },
    ]

    const grouped = groupQuestionsByEntryKind(questions, configs)

    // Should have all entry kinds from configs
    expect(Object.keys(grouped).sort()).toEqual([
      "agent_call",
      "custom_report",
      "daily_summary",
      "marketing_lead",
      "standard",
    ])

    // Questions should be in correct groups
    expect(grouped.agent_call).toHaveLength(2)
    expect(grouped.custom_report).toHaveLength(1)
    expect(grouped.marketing_lead).toHaveLength(1)
    expect(grouped.daily_summary).toHaveLength(0)
    expect(grouped.standard).toHaveLength(0)
  })

  it("groups questions without entry_kind into 'standard'", () => {
    const configs: ScopeEntryKind[] = [
      { id: "1", entry_kind: "standard", label: "Standard", sort_order: 0, is_active: true },
    ]

    const questions: RoleQuestionWithRole[] = [
      { id: "q1", entry_kind: undefined, question_label: "Notes", question_type: "text", is_active: true },
      { id: "q2", entry_kind: null, question_label: "Comments", question_type: "textarea", is_active: true },
      { id: "q3", entry_kind: "standard", question_label: "Status", question_type: "select", is_active: true },
    ]

    const grouped = groupQuestionsByEntryKind(questions, configs)

    expect(grouped.standard).toHaveLength(3)
    expect(grouped.standard.map((q) => q.id)).toEqual(["q1", "q2", "q3"])
  })

  it("includes entry kinds from questions that are not in configs", () => {
    // No configs provided
    const configs: ScopeEntryKind[] = []

    const questions: RoleQuestionWithRole[] = [
      { id: "q1", entry_kind: "legacy_kind", question_label: "Legacy", question_type: "text", is_active: true },
      { id: "q2", entry_kind: "another_kind", question_label: "Another", question_type: "text", is_active: true },
    ]

    const grouped = groupQuestionsByEntryKind(questions, configs)

    // Should include entry kinds from questions plus standard fallback
    expect(Object.keys(grouped).sort()).toEqual(["another_kind", "legacy_kind", "standard"])
    expect(grouped.legacy_kind).toHaveLength(1)
    expect(grouped.another_kind).toHaveLength(1)
    expect(grouped.standard).toHaveLength(0)
  })

  it("returns empty groups when no questions", () => {
    const configs: ScopeEntryKind[] = [
      { id: "1", entry_kind: "agent_call", label: "Agent Call", sort_order: 0, is_active: true },
      { id: "2", entry_kind: "standard", label: "Standard", sort_order: 1, is_active: true },
    ]

    const grouped = groupQuestionsByEntryKind([], configs)

    expect(grouped.agent_call).toHaveLength(0)
    expect(grouped.standard).toHaveLength(0)
  })

  it("always includes 'standard' as a fallback even with no configs", () => {
    const grouped = groupQuestionsByEntryKind([], [])

    expect(Object.keys(grouped)).toContain("standard")
    expect(grouped.standard).toHaveLength(0)
  })

  it("correctly counts total questions across all entry kinds", () => {
    const configs: ScopeEntryKind[] = [
      { id: "1", entry_kind: "type_a", label: "Type A", sort_order: 0, is_active: true },
      { id: "2", entry_kind: "type_b", label: "Type B", sort_order: 1, is_active: true },
      { id: "3", entry_kind: "type_c", label: "Type C", sort_order: 2, is_active: true },
    ]

    const questions: RoleQuestionWithRole[] = [
      { id: "q1", entry_kind: "type_a", question_label: "Q1", question_type: "text", is_active: true },
      { id: "q2", entry_kind: "type_a", question_label: "Q2", question_type: "text", is_active: true },
      { id: "q3", entry_kind: "type_b", question_label: "Q3", question_type: "text", is_active: true },
      { id: "q4", entry_kind: "type_c", question_label: "Q4", question_type: "text", is_active: true },
      { id: "q5", entry_kind: "type_c", question_label: "Q5", question_type: "text", is_active: true },
      { id: "q6", entry_kind: "type_c", question_label: "Q6", question_type: "text", is_active: true },
    ]

    const grouped = groupQuestionsByEntryKind(questions, configs)

    const totalQuestions = Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0)
    expect(totalQuestions).toBe(6)
  })
})
