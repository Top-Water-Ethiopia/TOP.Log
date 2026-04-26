import {
  getDateRange,
  isDateInRange,
  resolveUserName,
  type DateRangeType,
  type Range,
} from "../lib/admin-reports-utils"
import { endOfDay, startOfDay, startOfMonth, startOfWeek, subDays } from "date-fns"

describe("admin-reports-utils", () => {
  describe("getDateRange", () => {
    const now = new Date("2026-04-26T12:00:00Z") // Sunday, April 26, 2026

    it("returns correct range for 'today'", () => {
      const range = getDateRange("today", now)
      const expectedStart = startOfDay(now)
      const expectedEnd = endOfDay(now)

      expect(range.start).toEqual(expectedStart)
      expect(range.end).toEqual(expectedEnd)
    })

    it("returns correct range for 'week' with Monday start (Ethiopia business week)", () => {
      const range = getDateRange("week", now)
      const expectedStart = startOfWeek(now, { weekStartsOn: 1 }) // Monday
      const expectedEnd = endOfDay(now)

      expect(range.start).toEqual(expectedStart)
      expect(range.end).toEqual(expectedEnd)
    })

    it("returns correct range for 'month'", () => {
      const range = getDateRange("month", now)
      const expectedStart = startOfMonth(now)
      const expectedEnd = endOfDay(now)

      expect(range.start).toEqual(expectedStart)
      expect(range.end).toEqual(expectedEnd)
    })

    it("returns correct range for 'quarter'", () => {
      const range = getDateRange("quarter", now)
      // April is in Q2 (months 3-5, index 3 is April)
      // Q2 starts at month 3 (April 1st)
      const expectedStart = new Date(2026, 3, 1) // April 1, 2026
      const expectedEnd = endOfDay(now)

      expect(range.start).toEqual(expectedStart)
      expect(range.end).toEqual(expectedEnd)
    })

    it("handles Q1 correctly (Jan-Mar)", () => {
      const q1Date = new Date("2026-02-15T12:00:00Z")
      const range = getDateRange("quarter", q1Date)
      const expectedStart = new Date(2026, 0, 1) // January 1, 2026

      expect(range.start).toEqual(expectedStart)
    })

    it("handles Q3 correctly (Jul-Sep)", () => {
      const q3Date = new Date("2026-08-15T12:00:00Z")
      const range = getDateRange("quarter", q3Date)
      const expectedStart = new Date(2026, 6, 1) // July 1, 2026

      expect(range.start).toEqual(expectedStart)
    })

    it("handles Q4 correctly (Oct-Dec)", () => {
      const q4Date = new Date("2026-11-15T12:00:00Z")
      const range = getDateRange("quarter", q4Date)
      const expectedStart = new Date(2026, 9, 1) // October 1, 2026

      expect(range.start).toEqual(expectedStart)
    })
  })

  describe("isDateInRange", () => {
    const now = new Date("2026-04-26T12:00:00Z")
    const range: Range = {
      start: startOfDay(now),
      end: endOfDay(now),
    }

    it("returns true for date exactly at start boundary", () => {
      const atStart = startOfDay(now)
      expect(isDateInRange(atStart, range)).toBe(true)
    })

    it("returns true for date exactly at end boundary", () => {
      const atEnd = endOfDay(now)
      expect(isDateInRange(atEnd, range)).toBe(true)
    })

    it("returns true for date in the middle of range", () => {
      const inMiddle = new Date(now.getTime() - 1000 * 60 * 60) // 1 hour ago
      expect(isDateInRange(inMiddle, range)).toBe(true)
    })

    it("returns false for date before start", () => {
      const beforeStart = new Date(range.start.getTime() - 1000) // 1 second before
      expect(isDateInRange(beforeStart, range)).toBe(false)
    })

    it("returns false for date after end", () => {
      const afterEnd = new Date(range.end.getTime() + 1000) // 1 second after
      expect(isDateInRange(afterEnd, range)).toBe(false)
    })
  })

  describe("resolveUserName", () => {
    it("returns user_profile.name when available", () => {
      const entry = {
        user_profile: { name: "John Doe" },
        user_email: "john@example.com",
        user_id: "user123",
      }
      expect(resolveUserName(entry)).toBe("John Doe")
    })

    it("falls back to user_email when name is missing", () => {
      const entry = {
        user_profile: { name: null },
        user_email: "jane@example.com",
        user_id: "user456",
      }
      expect(resolveUserName(entry)).toBe("jane@example.com")
    })

    it("returns 'Deleted User' with ID slice when profile and email are missing", () => {
      const entry = {
        user_profile: null,
        user_email: null,
        user_id: "user789",
      }
      expect(resolveUserName(entry)).toBe("Deleted User (user78)")
    })

    it("returns 'Deleted User' when no user_id is available", () => {
      const entry = {
        user_profile: null,
        user_email: null,
        user_id: null,
      }
      expect(resolveUserName(entry)).toBe("Deleted User")
    })

    it("handles empty string user_id", () => {
      const entry = {
        user_profile: null,
        user_email: null,
        user_id: "",
      }
      expect(resolveUserName(entry)).toBe("Deleted User")
    })
  })
})
