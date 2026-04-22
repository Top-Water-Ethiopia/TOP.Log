import { canAccessLogByDepartmentSet } from "@/lib/logs/visibility"

describe("canAccessLogByDepartmentSet", () => {
  it("allows owner access even without readable departments", () => {
    const ok = canAccessLogByDepartmentSet(
      { user_id: "u1", department_id: "d1" },
      { userId: "u1", readableDepartments: new Set() }
    )
    expect(ok).toBe(true)
  })

  it("allows department-wide access when department is in readable set", () => {
    const ok = canAccessLogByDepartmentSet(
      { user_id: "u2", department_id: "d1" },
      { userId: "u1", readableDepartments: new Set(["d1"]) }
    )
    expect(ok).toBe(true)
  })

  it("denies cross-user access when department is not readable", () => {
    const ok = canAccessLogByDepartmentSet(
      { user_id: "u2", department_id: "d1" },
      { userId: "u1", readableDepartments: new Set(["d2"]) }
    )
    expect(ok).toBe(false)
  })

  it("denies cross-user access when department_id is null", () => {
    const ok = canAccessLogByDepartmentSet(
      { user_id: "u2", department_id: null },
      { userId: "u1", readableDepartments: new Set(["d1"]) }
    )
    expect(ok).toBe(false)
  })
})

