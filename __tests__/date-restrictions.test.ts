import {
  canCreateEntryForDate,
  canUpdateEntryForDate,
  formatLocalDate,
  getDaysAgo,
  getToday,
} from "../lib/date-restrictions"

describe("date restrictions", () => {
  it("allows creating entries for historical dates (any past date)", () => {
    const pastDate = getDaysAgo(10)
    const res = canCreateEntryForDate(pastDate)
    expect(res.isValid).toBe(true)
  })

  it("still blocks updating entries older than 2 days", () => {
    const oldDate = getDaysAgo(10)
    const res = canUpdateEntryForDate(oldDate)
    expect(res.isValid).toBe(false)
  })

  it("blocks creating entries for future dates", () => {
    const tomorrow = (() => {
      const d = new Date(getToday() + "T00:00:00")
      d.setDate(d.getDate() + 1)
      return formatLocalDate(d)
    })()

    const res = canCreateEntryForDate(tomorrow)
    expect(res.isValid).toBe(false)
  })
})
