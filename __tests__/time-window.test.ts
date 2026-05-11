import { buildWindowHash, resolveTimeWindowFromQuery } from "@/lib/time-window/server"
import { buildDepartmentCoalesceOrFilter, MARKETING_AGENT_CONTACTS_ENTRY_KIND } from "@/lib/marketing-kpis/agent-calls"

describe("TimeWindow resolver", () => {
  it("canonicalizes preset last7 and equivalent custom range to the same key", () => {
    const now = new Date("2026-05-04T10:00:00.000Z")

    const presetRes = resolveTimeWindowFromQuery({
      preset: "last7",
      date: null,
      dateFrom: null,
      dateTo: null,
      now,
      maxDays: 90,
      liveMaxDays: 31,
    })

    const rangeRes = resolveTimeWindowFromQuery({
      preset: null,
      date: null,
      dateFrom: presetRes.window.start,
      dateTo: presetRes.window.end,
      now,
      maxDays: 90,
      liveMaxDays: 31,
    })

    expect(rangeRes.window.key).toBe(presetRes.window.key)
  })

  it("builds stable window hash (v1) without user scoping", () => {
    const hash1 = buildWindowHash({ start: "2026-05-01", end: "2026-05-07", departmentId: "dept-123" })
    const hash2 = buildWindowHash({ start: "2026-05-01", end: "2026-05-07", departmentId: "dept-123" })
    expect(hash1).toBe(hash2)
  })
})

describe("Agent calls KPI department scoping", () => {
  it("counts rows in department even when subject_department_id is null (coalesce behavior)", () => {
    // Real-world legacy example:
    // - Older rows may have department_id set but subject_department_id still NULL.
    // - KPI should include both.
    const marketingDepartmentId = "00000000-0000-0000-0000-00000000abcd"
    const filter = buildDepartmentCoalesceOrFilter(marketingDepartmentId)
    expect(filter).toBe(
      `subject_department_id.eq.${marketingDepartmentId},and(subject_department_id.is.null,department_id.eq.${marketingDepartmentId})`
    )
  })
})

describe("Agent contacts entry kind", () => {
  it("uses agent_contact entry_kind for the KPI", () => {
    expect(MARKETING_AGENT_CONTACTS_ENTRY_KIND).toBe("agent_contact")
  })
})
