import { formatKpiNumber } from "@/lib/marketing-kpis/formatting/format-kpi-number"

describe("formatKpiNumber", () => {
  it("hides floating-point artifacts with max fraction digits", () => {
    expect(formatKpiNumber(554.1199999999999, { maximumFractionDigits: 2 })).toBe("554.12")
  })

  it("returns em dash for non-finite values", () => {
    expect(formatKpiNumber(Number.NaN)).toBe("—")
    expect(formatKpiNumber(Number.POSITIVE_INFINITY)).toBe("—")
  })
})

