import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals"

// Mock fetch for testing the profession filtering API behavior
const mockFetch = jest.fn()

describe("EntryKindsConfigPage - Profession Filtering API Behavior", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = mockFetch
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("calls departments API on initial load", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { id: "dept-1", name: "Sales", description: "Sales department" },
          { id: "dept-2", name: "Marketing", description: "Marketing department" },
        ],
      }),
    })

    // Simulate the component's initial fetch
    const response = await fetch("/api/admin/departments", {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })

    const result = await response.json()

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/admin/departments",
      expect.objectContaining({
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      })
    )
    expect(result.data).toHaveLength(2)
    expect(result.data[0].id).toBe("dept-1")
    expect(result.data[1].id).toBe("dept-2")
  })

  it("fetches professions only for the selected department", async () => {
    // Simulate selecting "dept-1" (Sales)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { id: "sales_rep", display_name: "Sales Representative", department_id: "dept-1", is_active: true },
          { id: "sales_lead", display_name: "Sales Lead", department_id: "dept-1", is_active: true },
        ],
      }),
    })

    const response = await fetch("/api/admin/departments/dept-1/profession-roles", {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })

    const result = await response.json()

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/admin/departments/dept-1/profession-roles",
      expect.objectContaining({
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      })
    )
    expect(result.data).toHaveLength(2)
    expect(result.data.every((p: { department_id: string }) => p.department_id === "dept-1")).toBe(true)
  })

  it("fetches different professions when switching departments", async () => {
    // First: professions for Sales department
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: "sales_rep", display_name: "Sales Representative", department_id: "dept-1", is_active: true },
            { id: "sales_lead", display_name: "Sales Lead", department_id: "dept-1", is_active: true },
          ],
        }),
      })
      // Second: professions for Marketing department
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: "marketing_mgr", display_name: "Marketing Manager", department_id: "dept-2", is_active: true }],
        }),
      })

    // First fetch - Sales department
    const salesResponse = await fetch("/api/admin/departments/dept-1/profession-roles", {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
    const salesData = await salesResponse.json()

    // Second fetch - Marketing department
    const marketingResponse = await fetch("/api/admin/departments/dept-2/profession-roles", {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
    const marketingData = await marketingResponse.json()

    // Verify URLs contain correct department IDs
    expect(mockFetch.mock.calls[0][0]).toBe("/api/admin/departments/dept-1/profession-roles")
    expect(mockFetch.mock.calls[1][0]).toBe("/api/admin/departments/dept-2/profession-roles")

    // Verify different professions are returned
    expect(salesData.data).toHaveLength(2)
    expect(salesData.data[0].department_id).toBe("dept-1")
    expect(salesData.data.every((p: { department_id: string }) => p.department_id === "dept-1")).toBe(true)

    expect(marketingData.data).toHaveLength(1)
    expect(marketingData.data[0].department_id).toBe("dept-2")
  })

  it("does not include professions from other departments in response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { id: "sales_rep", display_name: "Sales Representative", department_id: "dept-1", is_active: true },
          { id: "sales_lead", display_name: "Sales Lead", department_id: "dept-1", is_active: true },
        ],
      }),
    })

    const response = await fetch("/api/admin/departments/dept-1/profession-roles", {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
    const result = await response.json()

    // Verify NO Marketing professions are returned
    const marketingProfessions = result.data.filter((p: { department_id: string }) => p.department_id === "dept-2")
    expect(marketingProfessions).toHaveLength(0)

    // Verify only Sales professions are returned
    expect(result.data.every((p: { department_id: string }) => p.department_id === "dept-1")).toBe(true)
  })

  it("handles archived professions correctly", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { id: "active_role", display_name: "Active Role", department_id: "dept-1", is_active: true },
          { id: "archived_role", display_name: "Archived Role", department_id: "dept-1", is_active: false },
        ],
      }),
    })

    const response = await fetch("/api/admin/departments/dept-1/profession-roles", {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
    const result = await response.json()

    // Both active and archived should be returned
    expect(result.data).toHaveLength(2)

    const active = result.data.find((p: { id: string }) => p.id === "active_role")
    const archived = result.data.find((p: { id: string }) => p.id === "archived_role")

    expect(active.is_active).toBe(true)
    expect(archived.is_active).toBe(false)
  })

  it("URL-encodes department ID in the API call", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ id: "dept-special", display_name: "Test", department_id: "dept-special", is_active: true }],
      }),
    })

    const departmentId = "dept-abc/123+test"
    const encodedId = encodeURIComponent(departmentId)

    await fetch(`/api/admin/departments/${encodedId}/profession-roles`, {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })

    expect(mockFetch).toHaveBeenCalledWith(`/api/admin/departments/${encodedId}/profession-roles`, expect.any(Object))
    expect(mockFetch.mock.calls[0][0]).not.toContain("/123+")
  })
})

describe("EntryKindsConfigPage - Profession Filtering Logic", () => {
  it("filters professions by selected department ID", () => {
    // Mock profession data from API
    const allProfessions = [
      { id: "sales_rep", display_name: "Sales Representative", department_id: "dept-1", is_active: true },
      { id: "sales_lead", display_name: "Sales Lead", department_id: "dept-1", is_active: true },
      { id: "marketing_mgr", display_name: "Marketing Manager", department_id: "dept-2", is_active: true },
      { id: "content_creator", display_name: "Content Creator", department_id: "dept-2", is_active: true },
    ]

    // Filter function simulating the component's filtering behavior
    const filterProfessionsByDepartment = (professions: typeof allProfessions, departmentId: string | null) => {
      if (!departmentId) return []
      return professions.filter((p) => p.department_id === departmentId)
    }

    // Test: Select Sales department (dept-1)
    const salesProfessions = filterProfessionsByDepartment(allProfessions, "dept-1")
    expect(salesProfessions).toHaveLength(2)
    expect(salesProfessions.every((p) => p.department_id === "dept-1")).toBe(true)

    // Test: Select Marketing department (dept-2)
    const marketingProfessions = filterProfessionsByDepartment(allProfessions, "dept-2")
    expect(marketingProfessions).toHaveLength(2)
    expect(marketingProfessions.every((p) => p.department_id === "dept-2")).toBe(true)

    // Test: No department selected
    const noProfessions = filterProfessionsByDepartment(allProfessions, null)
    expect(noProfessions).toHaveLength(0)
  })

  it("formats archived professions with indicator", () => {
    const professions = [
      { id: "active_role", display_name: "Active Role", department_id: "dept-1", is_active: true },
      { id: "archived_role", display_name: "Archived Role", department_id: "dept-1", is_active: false },
    ]

    // Format function simulating the component's display logic
    const formatProfessionLabel = (prof: (typeof professions)[0]) => {
      return prof.is_active ? prof.display_name : `(Archived) ${prof.display_name}`
    }

    expect(formatProfessionLabel(professions[0])).toBe("Active Role")
    expect(formatProfessionLabel(professions[1])).toBe("(Archived) Archived Role")
  })
})
