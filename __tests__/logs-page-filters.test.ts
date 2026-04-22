import { normalizeLogsPageState, buildLogsPageHref, isValidLogsDate } from "@/lib/logs-page-filters"
import type { LogsPageSearchParams } from "@/lib/logs-page-filters"

describe("Logs page filters - search functionality", () => {
  describe("normalizeLogsPageState - searchName validation", () => {
    it("accepts valid search names (2-50 characters)", () => {
      const params: LogsPageSearchParams = {
        searchName: "alice",
      }
      const state = normalizeLogsPageState(params)
      expect(state.searchName).toBe("alice")
    })

    it("trims whitespace from search name", () => {
      const params: LogsPageSearchParams = {
        searchName: "  alice  ",
      }
      const state = normalizeLogsPageState(params)
      expect(state.searchName).toBe("alice")
    })

    it("converts search name to lowercase", () => {
      const params: LogsPageSearchParams = {
        searchName: "ALICE",
      }
      const state = normalizeLogsPageState(params)
      expect(state.searchName).toBe("alice")
    })

    it("rejects search names shorter than 2 characters", () => {
      const params: LogsPageSearchParams = {
        searchName: "a",
      }
      const state = normalizeLogsPageState(params)
      expect(state.searchName).toBeUndefined()
    })

    it("rejects search names longer than 50 characters", () => {
      const params: LogsPageSearchParams = {
        searchName: "a".repeat(51),
      }
      const state = normalizeLogsPageState(params)
      expect(state.searchName).toBeUndefined()
    })

    it("rejects empty search names (whitespace only)", () => {
      const params: LogsPageSearchParams = {
        searchName: "   ",
      }
      const state = normalizeLogsPageState(params)
      expect(state.searchName).toBeUndefined()
    })

    it("accepts exactly 2 characters (minimum)", () => {
      const params: LogsPageSearchParams = {
        searchName: "ab",
      }
      const state = normalizeLogsPageState(params)
      expect(state.searchName).toBe("ab")
    })

    it("accepts exactly 50 characters (maximum)", () => {
      const params: LogsPageSearchParams = {
        searchName: "a".repeat(50),
      }
      const state = normalizeLogsPageState(params)
      expect(state.searchName).toBe("a".repeat(50))
    })

    it("handles undefined searchName gracefully", () => {
      const params: LogsPageSearchParams = {}
      const state = normalizeLogsPageState(params)
      expect(state.searchName).toBeUndefined()
    })

    it("normalizes search name with other filters", () => {
      const params: LogsPageSearchParams = {
        date: "2026-04-20",
        departmentId: "dept-1",
        searchName: "  BOB  ",
        view: "list",
      }
      const state = normalizeLogsPageState(params)
      expect(state.searchName).toBe("bob")
      expect(state.date).toBe("2026-04-20")
      expect(state.departmentId).toBe("dept-1")
    })
  })

  describe("buildLogsPageHref - searchName in URL", () => {
    it("includes searchName in query params when provided", () => {
      const href = buildLogsPageHref({
        searchName: "alice",
      })
      expect(href).toContain("searchName=alice")
    })

    it("excludes searchName from query params when undefined", () => {
      const href = buildLogsPageHref({})
      expect(href).not.toContain("searchName")
    })

    it("combines searchName with other filters", () => {
      const href = buildLogsPageHref({
        date: "2026-04-20",
        departmentId: "dept-1",
        searchName: "alice",
      })
      expect(href).toContain("date=2026-04-20")
      expect(href).toContain("departmentId=dept-1")
      expect(href).toContain("searchName=alice")
    })

    it("includes searchName with cursor params", () => {
      const href = buildLogsPageHref({
        searchName: "alice",
        nextCursorDate: "2026-04-19",
        nextCursorId: "entry-123",
      })
      expect(href).toContain("searchName=alice")
      expect(href).toContain("nextCursorDate=2026-04-19")
      expect(href).toContain("nextCursorId=entry-123")
    })

    it("clears searchName when set to undefined", () => {
      const href = buildLogsPageHref({
        searchName: undefined,
      })
      expect(href).not.toContain("searchName")
    })
  })

  describe("searchName edge cases", () => {
    it("handles special characters in search name", () => {
      const params: LogsPageSearchParams = {
        searchName: "mary-jane",
      }
      const state = normalizeLogsPageState(params)
      expect(state.searchName).toBe("mary-jane")
    })

    it("handles numbers in search name", () => {
      const params: LogsPageSearchParams = {
        searchName: "user123",
      }
      const state = normalizeLogsPageState(params)
      expect(state.searchName).toBe("user123")
    })

    it("handles mixed case with spaces", () => {
      const params: LogsPageSearchParams = {
        searchName: "  John Doe  ",
      }
      const state = normalizeLogsPageState(params)
      expect(state.searchName).toBe("john doe")
    })

    it("handles unicode characters", () => {
      const params: LogsPageSearchParams = {
        searchName: "José",
      }
      const state = normalizeLogsPageState(params)
      expect(state.searchName).toBe("josé")
    })
  })

  describe("searchName with date validation", () => {
    it("normalizes valid date and search name together", () => {
      const params: LogsPageSearchParams = {
        date: "2026-04-20",
        searchName: "alice",
      }
      const state = normalizeLogsPageState(params)
      expect(state.date).toBe("2026-04-20")
      expect(state.searchName).toBe("alice")
    })

    it("ignores invalid date but keeps valid search name", () => {
      const params: LogsPageSearchParams = {
        date: "invalid-date",
        searchName: "alice",
      }
      const state = normalizeLogsPageState(params)
      expect(state.date).toBeUndefined()
      expect(state.searchName).toBe("alice")
    })

    it("ignores invalid search name but keeps valid date", () => {
      const params: LogsPageSearchParams = {
        date: "2026-04-20",
        searchName: "a", // too short
      }
      const state = normalizeLogsPageState(params)
      expect(state.date).toBe("2026-04-20")
      expect(state.searchName).toBeUndefined()
    })
  })
})
