import {
  buildLogsWorkspaceFilterHash,
  canonicalizeLogsWorkspaceFilters,
  isValidWorkspaceDate,
} from "@/lib/logs-workspace/filters"

describe("logs workspace filters", () => {
  it("locks the department filter over URL input", () => {
    const state = canonicalizeLogsWorkspaceFilters(
      {
        dateFrom: "2026-05-01",
        dateTo: "2026-05-07",
        departmentId: "tampered" } as any,
      { lockedDepartmentId: "marketing-dept" }
    )

    expect(state.departmentId).toBe("marketing-dept")
  })

  it("builds stable hashes from canonical filter state", () => {
    const base = {
      dateFrom: "2026-05-01",
      dateTo: "2026-05-07",
      departmentId: "marketing-dept",
      entryKind: "agent_contact",
      searchName: "abebe",
    }

    expect(buildLogsWorkspaceFilterHash(base)).toBe(buildLogsWorkspaceFilterHash({ ...base }))
  })

  it("rejects invalid dates", () => {
    expect(isValidWorkspaceDate("2026-05-12")).toBe(true)
    expect(isValidWorkspaceDate("2026-99-12")).toBe(false)
    expect(isValidWorkspaceDate("not-a-date")).toBe(false)
  })
})

