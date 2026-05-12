import { formatKpiDurationFromMinutes } from "@/lib/marketing-kpis/formatting/format-kpi-duration"

describe("formatKpiDurationFromMinutes", () => {
  it("formats sub-hour values as Xm", () => {
    expect(formatKpiDurationFromMinutes(0)).toEqual({ headline: "0m", isValid: true })
    expect(formatKpiDurationFromMinutes(45)).toEqual({ headline: "45m", isValid: true })
  })

  it("formats exact hours without 0m", () => {
    expect(formatKpiDurationFromMinutes(60)).toEqual({ headline: "1h", isValid: true })
    expect(formatKpiDurationFromMinutes(120)).toEqual({ headline: "2h", isValid: true })
  })

  it("rounds total minutes first then splits", () => {
    expect(formatKpiDurationFromMinutes(59.4)).toEqual({ headline: "59m", isValid: true })
    expect(formatKpiDurationFromMinutes(59.5)).toEqual({ headline: "1h", isValid: true })
    expect(formatKpiDurationFromMinutes(554.12)).toEqual({ headline: "9h 14m", isValid: true })
  })

  it("returns invalid marker for non-finite values", () => {
    expect(formatKpiDurationFromMinutes(Number.NaN)).toEqual({ headline: "—", isValid: false })
    expect(formatKpiDurationFromMinutes(Number.POSITIVE_INFINITY)).toEqual({ headline: "—", isValid: false })
  })
})

