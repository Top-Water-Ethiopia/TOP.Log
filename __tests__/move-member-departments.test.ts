/**
 * Tests for move member sidebar department fetching
 * Verifies API response structure transformation
 */

// Mock the API response structure from /api/departments
const mockApiDepartmentsResponse = {
  data: [
    {
      department_id: "dept-1",
      department: { name: "Engineering" },
      roleType: "profession",
      roleKey: "developer",
      roleLabel: "Developer",
    },
    {
      department_id: "dept-2",
      department: { name: "Marketing" },
      roleType: "profession",
      roleKey: "marketer",
      roleLabel: "Marketer",
    },
    {
      department_id: "dept-3",
      department: null, // Edge case: null department
      roleType: "department_lead",
      roleKey: "department-lead",
      roleLabel: "Department Lead",
    },
    {
      department_id: "dept-4",
      department: { name: undefined }, // Edge case: undefined name
      roleType: "profession",
      roleKey: "designer",
      roleLabel: "Designer",
    },
  ],
  hasSystemWideAccess: true,
}

// The transformation logic from the move dialog (must match page.tsx implementation)
function transformDepartmentsForMoveDialog(
  response: typeof mockApiDepartmentsResponse,
  currentDepartmentId: string
) {
  if (!response.data) return []

  const departments = response.data.map((m) => ({
    id: m.department_id,
    name: m.department?.name || "Unnamed Department",
  }))

  return departments.filter((d) => d.id !== currentDepartmentId)
}

describe("Move Member - Department Fetching", () => {
  it("transforms API response to { id, name } format for move dialog", () => {
    const result = transformDepartmentsForMoveDialog(mockApiDepartmentsResponse, "current-dept")

    expect(result).toEqual([
      { id: "dept-1", name: "Engineering" },
      { id: "dept-2", name: "Marketing" },
      { id: "dept-3", name: "Unnamed Department" },
      { id: "dept-4", name: "Unnamed Department" },
    ])
  })

  it("excludes the current department from the list", () => {
    const result = transformDepartmentsForMoveDialog(mockApiDepartmentsResponse, "dept-1")

    expect(result.some((d) => d.id === "dept-1")).toBe(false)
    expect(result).toHaveLength(3)
    expect(result.map((d) => d.id)).toEqual(["dept-2", "dept-3", "dept-4"])
  })

  it("handles null department data gracefully", () => {
    const responseWithNull = {
      data: [
        {
          department_id: "dept-null",
          department: null,
          roleType: "profession",
          roleKey: "test",
          roleLabel: "Test",
        },
      ],
      hasSystemWideAccess: true,
    }

    const result = transformDepartmentsForMoveDialog(responseWithNull, "other-dept")

    expect(result).toEqual([{ id: "dept-null", name: "Unnamed Department" }])
  })

  it("handles undefined department name gracefully", () => {
    const responseWithUndefined = {
      data: [
        {
          department_id: "dept-undef",
          department: { name: undefined },
          roleType: "profession",
          roleKey: "test",
          roleLabel: "Test",
        },
      ],
      hasSystemWideAccess: true,
    }

    const result = transformDepartmentsForMoveDialog(responseWithUndefined, "other-dept")

    expect(result).toEqual([{ id: "dept-undef", name: "Unnamed Department" }])
  })

  it("handles empty response data", () => {
    const emptyResponse = { data: [], hasSystemWideAccess: true }

    const result = transformDepartmentsForMoveDialog(emptyResponse, "any-dept")

    expect(result).toEqual([])
  })

  it("handles missing data field", () => {
    const responseWithoutData = { hasSystemWideAccess: true }

    const result = transformDepartmentsForMoveDialog(responseWithoutData as any, "any-dept")

    expect(result).toEqual([])
  })
})

export {}
