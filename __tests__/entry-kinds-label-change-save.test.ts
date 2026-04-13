import { describe, it, expect, jest } from "@jest/globals"

// Replicates the core state logic from EntryKindsConfigPage to test the bug fix:
// Previously, the useEffect that initialized editedConfigs had `editedConfigs.length`
// as a dependency, causing it to re-run and reset edits whenever the user changed a label.
// The fix uses a ref (hasInitialized) to ensure initialization only happens once per scope.

type ScopeEntryKind = {
  id: string
  entry_kind: string
  label: string
  description: string | null
  sort_order: number
  is_default: boolean
  is_active: boolean
  supports_assigned_agent: boolean
  allow_multiple_per_day: boolean
  color: string | null
  icon: string | null
}

function simulateEntryKindsState(initialEntryKinds: ScopeEntryKind[]) {
  // Simulates the component's state logic
  let editedConfigs: ScopeEntryKind[] = []
  let hasChanges = false
  let initializedScopeKey = ""

  // Build scope key from selections
  function buildScopeKey(departmentId: string, system: string, profession: string) {
    return `${departmentId}|${system}|${profession}`
  }

  // Scope change effect (resets everything)
  function onScopeChange(departmentId: string, system: string, profession: string) {
    editedConfigs = []
    hasChanges = false
    // Note: initializedScopeKey is NOT reset here - the init effect checks it
  }

  // Initialize effect (scope-key version - only runs when scope key changes)
  function onEntryKindsLoaded(entryKinds: ScopeEntryKind[], scopeKey: string) {
    if (entryKinds.length > 0 && initializedScopeKey !== scopeKey) {
      // Deduplicate
      const seen = new Set<string>()
      const deduplicated = entryKinds.filter((config) => {
        if (seen.has(config.entry_kind)) return false
        seen.add(config.entry_kind)
        return true
      })
      editedConfigs = deduplicated
      initializedScopeKey = scopeKey
    }
  }

  // OLD buggy version - re-initializes whenever editedConfigs.length changes
  function onEntryKindsLoadedBuggy(entryKinds: ScopeEntryKind[]) {
    if (entryKinds.length > 0 && editedConfigs.length === 0) {
      const seen = new Set<string>()
      const deduplicated = entryKinds.filter((config) => {
        if (seen.has(config.entry_kind)) return false
        seen.add(config.entry_kind)
        return true
      })
      editedConfigs = deduplicated
    }
  }

  // Handler functions
  function handleUpdateLabel(index: number, label: string) {
    const newConfigs = [...editedConfigs]
    newConfigs[index] = { ...newConfigs[index], label }
    editedConfigs = newConfigs
    hasChanges = true
  }

  function handleToggleActive(index: number) {
    const config = editedConfigs[index]
    const newConfigs = [...editedConfigs]
    newConfigs[index] = { ...config, is_active: !config.is_active }
    editedConfigs = newConfigs
    hasChanges = true
  }

  function handleSetDefault(index: number) {
    const newConfigs = editedConfigs.map((c, i) => ({
      ...c,
      is_default: i === index,
    }))
    editedConfigs = newConfigs
    hasChanges = true
  }

  function handleUpdateDescription(index: number, description: string) {
    const newConfigs = [...editedConfigs]
    newConfigs[index] = { ...newConfigs[index], description }
    editedConfigs = newConfigs
    hasChanges = true
  }

  return {
    get editedConfigs() {
      return editedConfigs
    },
    get hasChanges() {
      return hasChanges
    },
    onScopeChange,
    onEntryKindsLoaded,
    onEntryKindsLoadedBuggy,
    handleUpdateLabel,
    handleToggleActive,
    handleSetDefault,
    handleUpdateDescription,
  }
}

const mockEntryKinds: ScopeEntryKind[] = [
  {
    id: "1",
    entry_kind: "daily_log",
    label: "Daily Log",
    description: "Daily log entry",
    sort_order: 0,
    is_default: true,
    is_active: true,
    supports_assigned_agent: false,
    allow_multiple_per_day: false,
    color: "#3B82F6",
    icon: "FileText",
  },
  {
    id: "2",
    entry_kind: "phone_call",
    label: "Phone Call",
    description: "Phone call entry",
    sort_order: 1,
    is_default: false,
    is_active: true,
    supports_assigned_agent: true,
    allow_multiple_per_day: true,
    color: "#10B981",
    icon: "Phone",
  },
]

describe("EntryKindsConfigPage - Label Change Activates Save Button", () => {
  it("label change sets hasChanges=true with fixed initialization", () => {
    const state = simulateEntryKindsState(mockEntryKinds)
    const scopeKey = "dept-1|personal|_dept_wide_personal_"

    state.onEntryKindsLoaded(mockEntryKinds, scopeKey)

    expect(state.editedConfigs).toHaveLength(2)
    expect(state.editedConfigs[0].label).toBe("Daily Log")
    expect(state.hasChanges).toBe(false)

    state.handleUpdateLabel(0, "Daily Report")

    expect(state.editedConfigs[0].label).toBe("Daily Report")
    expect(state.hasChanges).toBe(true)
  })

  it("label change persists even when onEntryKindsLoaded re-runs with same scope key", () => {
    const state = simulateEntryKindsState(mockEntryKinds)
    const scopeKey = "dept-1|personal|_dept_wide_personal_"

    state.onEntryKindsLoaded(mockEntryKinds, scopeKey)
    state.handleUpdateLabel(0, "Daily Report")
    expect(state.editedConfigs[0].label).toBe("Daily Report")
    expect(state.hasChanges).toBe(true)

    // Simulate SWR revalidation with same scope key - should NOT reset
    state.onEntryKindsLoaded(mockEntryKinds, scopeKey)

    expect(state.editedConfigs[0].label).toBe("Daily Report")
    expect(state.hasChanges).toBe(true)
  })

  it("BUG: old version resets edits when onEntryKindsLoaded re-runs", () => {
    const state = simulateEntryKindsState(mockEntryKinds)

    state.onEntryKindsLoadedBuggy(mockEntryKinds)
    state.handleUpdateLabel(0, "Daily Report")
    expect(state.editedConfigs[0].label).toBe("Daily Report")
    expect(state.hasChanges).toBe(true)

    // Scope change resets editedConfigs to []
    state.onScopeChange("dept-1", "personal", "_dept_wide_personal_")
    expect(state.editedConfigs).toHaveLength(0)
    expect(state.hasChanges).toBe(false)

    // Buggy version re-initializes from original data
    state.onEntryKindsLoadedBuggy(mockEntryKinds)
    expect(state.editedConfigs[0].label).toBe("Daily Log")
  })

  it("multiple label changes all persist with fixed version", () => {
    const state = simulateEntryKindsState(mockEntryKinds)
    const scopeKey = "dept-1|personal|_dept_wide_personal_"

    state.onEntryKindsLoaded(mockEntryKinds, scopeKey)
    state.handleUpdateLabel(0, "Daily Report")
    state.handleUpdateLabel(1, "Client Call")

    expect(state.editedConfigs[0].label).toBe("Daily Report")
    expect(state.editedConfigs[1].label).toBe("Client Call")
    expect(state.hasChanges).toBe(true)

    // Re-run with same scope key (should be a no-op)
    state.onEntryKindsLoaded(mockEntryKinds, scopeKey)

    expect(state.editedConfigs[0].label).toBe("Daily Report")
    expect(state.editedConfigs[1].label).toBe("Client Call")
  })

  it("scope change resets edits and allows re-initialization", () => {
    const state = simulateEntryKindsState(mockEntryKinds)
    const scopeKey1 = "dept-1|personal|_dept_wide_personal_"
    const scopeKey2 = "dept-1|personal|role-123"

    state.onEntryKindsLoaded(mockEntryKinds, scopeKey1)
    state.handleUpdateLabel(0, "Daily Report")
    expect(state.hasChanges).toBe(true)

    // Change scope - resets state
    state.onScopeChange("dept-1", "personal", "role-123")
    expect(state.editedConfigs).toHaveLength(0)
    expect(state.hasChanges).toBe(false)

    // Load entry kinds for new scope
    state.onEntryKindsLoaded(mockEntryKinds, scopeKey2)

    expect(state.editedConfigs[0].label).toBe("Daily Log")
    expect(state.hasChanges).toBe(false)
  })

  it("switching from dept-wide to profession role initializes correctly", () => {
    const state = simulateEntryKindsState(mockEntryKinds)
    const deptWideKey = "dept-1|personal|_dept_wide_personal_"
    const professionKey = "dept-1|personal|role-123"

    // Start with dept-wide
    state.onEntryKindsLoaded(mockEntryKinds, deptWideKey)
    expect(state.editedConfigs).toHaveLength(2)

    // Switch to profession role
    state.onScopeChange("dept-1", "personal", "role-123")
    expect(state.editedConfigs).toHaveLength(0)

    // Load profession entry kinds
    const professionEntryKinds = [{ ...mockEntryKinds[0], id: "10", label: "Prof Daily Log" }]
    state.onEntryKindsLoaded(professionEntryKinds, professionKey)

    expect(state.editedConfigs).toHaveLength(1)
    expect(state.editedConfigs[0].label).toBe("Prof Daily Log")

    // Change label - should activate save
    state.handleUpdateLabel(0, "Prof Report")
    expect(state.editedConfigs[0].label).toBe("Prof Report")
    expect(state.hasChanges).toBe(true)

    // SWR revalidation should NOT reset
    state.onEntryKindsLoaded(professionEntryKinds, professionKey)
    expect(state.editedConfigs[0].label).toBe("Prof Report")
  })

  it("switching from personal to dept_report initializes correctly", () => {
    const state = simulateEntryKindsState(mockEntryKinds)
    const personalKey = "dept-1|personal|_dept_wide_personal_"
    const deptReportKey = "dept-1|dept_report|_dept_wide_personal_"

    // Start with personal
    state.onEntryKindsLoaded(mockEntryKinds, personalKey)
    state.handleUpdateLabel(0, "Daily Report")
    expect(state.hasChanges).toBe(true)

    // Switch to dept_report
    state.onScopeChange("dept-1", "dept_report", "_dept_wide_personal_")
    expect(state.editedConfigs).toHaveLength(0)

    // Load dept_report entry kinds
    const reportEntryKinds = [{ ...mockEntryKinds[0], id: "20", label: "Report Entry" }]
    state.onEntryKindsLoaded(reportEntryKinds, deptReportKey)

    expect(state.editedConfigs).toHaveLength(1)
    expect(state.editedConfigs[0].label).toBe("Report Entry")

    // Change label - should activate save
    state.handleUpdateLabel(0, "Updated Report")
    expect(state.hasChanges).toBe(true)

    // SWR revalidation should NOT reset
    state.onEntryKindsLoaded(reportEntryKinds, deptReportKey)
    expect(state.editedConfigs[0].label).toBe("Updated Report")
  })

  it("toggle active sets hasChanges=true", () => {
    const state = simulateEntryKindsState(mockEntryKinds)
    const scopeKey = "dept-1|personal|_dept_wide_personal_"

    state.onEntryKindsLoaded(mockEntryKinds, scopeKey)
    expect(state.hasChanges).toBe(false)

    state.handleToggleActive(1)
    expect(state.editedConfigs[1].is_active).toBe(false)
    expect(state.hasChanges).toBe(true)
  })

  it("set default sets hasChanges=true", () => {
    const state = simulateEntryKindsState(mockEntryKinds)
    const scopeKey = "dept-1|personal|_dept_wide_personal_"

    state.onEntryKindsLoaded(mockEntryKinds, scopeKey)
    expect(state.hasChanges).toBe(false)

    state.handleSetDefault(1)
    expect(state.editedConfigs[1].is_default).toBe(true)
    expect(state.editedConfigs[0].is_default).toBe(false)
    expect(state.hasChanges).toBe(true)
  })

  it("description change sets hasChanges=true", () => {
    const state = simulateEntryKindsState(mockEntryKinds)
    const scopeKey = "dept-1|personal|_dept_wide_personal_"

    state.onEntryKindsLoaded(mockEntryKinds, scopeKey)
    state.handleUpdateDescription(0, "Updated description")

    expect(state.editedConfigs[0].description).toBe("Updated description")
    expect(state.hasChanges).toBe(true)
  })

  it("deduplicates entry kinds by entry_kind on initialization", () => {
    const duplicates = [
      ...mockEntryKinds,
      { ...mockEntryKinds[0], id: "3" }, // duplicate entry_kind "daily_log"
    ]
    const scopeKey = "dept-1|personal|_dept_wide_personal_"

    const state = simulateEntryKindsState(duplicates)
    state.onEntryKindsLoaded(duplicates, scopeKey)

    expect(state.editedConfigs).toHaveLength(2) // deduplicated
  })

  it("save button should be enabled when hasChanges=true and validation passes", () => {
    const state = simulateEntryKindsState(mockEntryKinds)
    const scopeKey = "dept-1|personal|_dept_wide_personal_"

    state.onEntryKindsLoaded(mockEntryKinds, scopeKey)

    const active = state.editedConfigs.filter((c) => c.is_active)
    const defaults = active.filter((c) => c.is_default)
    const validationValid = active.length > 0 && defaults.length === 1

    expect(validationValid).toBe(true)
    expect(state.hasChanges).toBe(false)

    state.handleUpdateLabel(0, "Daily Report")

    const saveDisabled = !state.hasChanges || !validationValid
    expect(saveDisabled).toBe(false)
  })

  it("save button stays disabled when hasChanges=false", () => {
    const state = simulateEntryKindsState(mockEntryKinds)
    const scopeKey = "dept-1|personal|_dept_wide_personal_"

    state.onEntryKindsLoaded(mockEntryKinds, scopeKey)

    const saveDisabled = !state.hasChanges
    expect(saveDisabled).toBe(true)
  })
})
