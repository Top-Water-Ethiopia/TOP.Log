import {
  canViewDepartmentLogs,
  normalizeDepartmentAccessLevelName,
  shouldRestrictLogsToOwnEntries,
} from "@/lib/logs/visibility"

describe("logs visibility", () => {
  it("treats department lead access levels as department-wide visibility", () => {
    expect(canViewDepartmentLogs("department-lead")).toBe(true)
    expect(canViewDepartmentLogs("department_lead")).toBe(true)
    expect(canViewDepartmentLogs("Department Lead")).toBe(true)
  })

  it("keeps contributors restricted to their own entries", () => {
    expect(canViewDepartmentLogs("contributor")).toBe(false)
    expect(shouldRestrictLogsToOwnEntries("contributor")).toBe(true)
  })

  it("normalizes access level names consistently", () => {
    expect(normalizeDepartmentAccessLevelName(" Department Lead ")).toBe("department-lead")
    expect(normalizeDepartmentAccessLevelName("department_lead")).toBe("department-lead")
  })
})
