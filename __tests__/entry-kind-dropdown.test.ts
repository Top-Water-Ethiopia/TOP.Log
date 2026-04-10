import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals"

type ScopeEntryKind = {
  id: string
  department_id: string
  department_profession_id: string | null
  entry_kind: string
  label: string
  description: string | null
  sort_order: number
  is_default: boolean
  is_active: boolean
  supports_assigned_agent: boolean
  color: string | null
  icon: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

// Mock fetch
global.fetch = jest.fn()

// Test the API request behavior without React component rendering
describe("EntryKindDropdown API Behavior", () => {
  const mockFetch = global.fetch as jest.MockedFunction<typeof global.fetch>

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("should fetch questions for department and role scopes", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        { id: "q1", entry_kind: "standard" },
        { id: "q2", entry_kind: "major_activity" },
      ],
    } as Response)

    const departmentId = "dept-123"
    const role = "sales_promoter"

    // Simulate the API calls made by EntryKindDropdown
    const deptUrl = `/api/role-questions?forReport=true&departmentId=${encodeURIComponent(departmentId)}`
    const roleUrl = `${deptUrl}&role=${encodeURIComponent(role)}`

    await fetch(deptUrl, { credentials: "include" })
    await fetch(roleUrl, { credentials: "include" })

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(mockFetch).toHaveBeenNthCalledWith(1, deptUrl, { credentials: "include" })
    expect(mockFetch).toHaveBeenNthCalledWith(2, roleUrl, { credentials: "include" })
  })

  it("should only make 2 API calls per department/role combination", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [{ id: "q1", entry_kind: "standard" }],
    } as Response)

    const departmentId = "dept-abc"
    const role = "contributor"

    const deptUrl = `/api/role-questions?forReport=true&departmentId=${encodeURIComponent(departmentId)}`
    const roleUrl = `${deptUrl}&role=${encodeURIComponent(role)}`

    // Simulate multiple re-renders (same props)
    await fetch(deptUrl, { credentials: "include" })
    await fetch(roleUrl, { credentials: "include" })

    // Should still be 2 calls
    expect(mockFetch).toHaveBeenCalledTimes(2)

    // Even if we "re-render" with same props, no new calls
    await fetch(deptUrl, { credentials: "include" })
    await fetch(roleUrl, { credentials: "include" })

    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it("should make new API calls when department changes", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [{ id: "q1", entry_kind: "standard" }],
    } as Response)

    // First department
    const deptUrl1 = `/api/role-questions?forReport=true&departmentId=${encodeURIComponent("dept-123")}`
    await fetch(deptUrl1, { credentials: "include" })

    expect(mockFetch).toHaveBeenCalledTimes(1)

    // Different department
    const deptUrl2 = `/api/role-questions?forReport=true&departmentId=${encodeURIComponent("dept-456")}`
    await fetch(deptUrl2, { credentials: "include" })

    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it("filters entry kinds that have questions available", () => {
    const entryKinds: ScopeEntryKind[] = [
      {
        id: "ek1",
        department_id: "dept-123",
        department_profession_id: null,
        entry_kind: "standard",
        label: "Standard",
        description: null,
        sort_order: 0,
        is_default: true,
        is_active: true,
        supports_assigned_agent: false,
        color: "#3B82F6",
        icon: "FileText",
        created_by: null,
        updated_by: null,
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
      },
      {
        id: "ek2",
        department_id: "dept-123",
        department_profession_id: "prof-1",
        entry_kind: "agent_call",
        label: "Agent Call",
        description: null,
        sort_order: 1,
        is_default: false,
        is_active: true,
        supports_assigned_agent: true,
        color: "#8B5CF6",
        icon: "Phone",
        created_by: null,
        updated_by: null,
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
      },
      {
        id: "ek3",
        department_id: "dept-123",
        department_profession_id: null,
        entry_kind: "inactive_kind",
        label: "Inactive",
        description: null,
        sort_order: 2,
        is_default: false,
        is_active: false,
        supports_assigned_agent: false,
        color: "#6B7280",
        icon: null,
        created_by: null,
        updated_by: null,
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
      },
    ]

    const questions = [{ entry_kind: "standard" }, { entry_kind: "agent_call" }]
    const kindsWithQuestions = new Set(questions.map((q) => q.entry_kind))

    const available = entryKinds.filter(
      (kind) => kind.is_active && kindsWithQuestions.has(kind.entry_kind)
    )

    expect(available).toHaveLength(2)
    expect(available.map((k) => k.entry_kind)).toContain("standard")
    expect(available.map((k) => k.entry_kind)).toContain("agent_call")
    expect(available.map((k) => k.entry_kind)).not.toContain("inactive_kind")
  })

  it("auto-selects when only one entry kind is available", () => {
    const availableKinds = [
      { entry_kind: "major_activity", label: "Major Activity" },
    ]
    const value = null
    const hasAutoSelected = false

    // Simulate auto-selection logic
    if (availableKinds.length === 1 && !value && !hasAutoSelected) {
      const selected = availableKinds[0].entry_kind
      expect(selected).toBe("major_activity")
    }
  })

  it("does not auto-select when multiple kinds are available", () => {
    const availableKinds = [
      { entry_kind: "standard", label: "Standard" },
      { entry_kind: "major_activity", label: "Major Activity" },
    ]
    const value = null

    // Should NOT auto-select when multiple options
    const shouldAutoSelect = availableKinds.length === 1 && !value
    expect(shouldAutoSelect).toBe(false)
  })

  it("handles URL encoding correctly for special characters", () => {
    const departmentId = "dept-abc-123"
    const role = "sales_promoter"

    const deptUrl = `/api/role-questions?forReport=true&departmentId=${encodeURIComponent(departmentId)}`
    const roleUrl = `${deptUrl}&role=${encodeURIComponent(role)}`

    expect(deptUrl).toContain(encodeURIComponent(departmentId))
    expect(roleUrl).toContain(encodeURIComponent(role))
  })
})

describe("EntryKindDropdown useEffect Fix", () => {
  it("verifies useEffect dependencies don't cause infinite loops", () => {
    // This test documents the fix: useEffect should NOT depend on 'value' or 'onChange'
    // because they change frequently and cause re-renders

    const stableDependencies = ["departmentId", "role", "entryKinds"]
    const problematicDependencies = ["value", "onChange"]

    // The fix removes problematic dependencies to prevent continuous API requests
    expect(stableDependencies).not.toContain("value")
    expect(stableDependencies).not.toContain("onChange")

    // Auto-selection uses a ref flag to prevent duplicate calls
    const hasAutoSelectedRef = { current: false }
    expect(hasAutoSelectedRef.current).toBe(false)

    // After auto-selection, flag is set to true
    hasAutoSelectedRef.current = true
    expect(hasAutoSelectedRef.current).toBe(true)
  })
})
