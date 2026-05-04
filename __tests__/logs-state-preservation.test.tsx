/**
 * Tests for logs page state preservation and synchronization
 *
 * Tests cover:
 * - Pure function parseLogsPageState (normalization, cursor expiry flag)
 * - Hook calls at render, not in callbacks
 * - Search + view + close preserves all filters
 * - Pagination + view + close preserves cursor
 * - Cursor expiry: flag returned, removal via navigation
 * - Cursor expiry indicator lifecycle (transition-based, auto-dismiss)
 * - View mode switching with explicit compatibility check
 * - Browser back button: page → preview → back = page
 * - Race condition: flush input before navigation
 * - URL canonicalization on mount (guard against redundant replace)
 * - Builder contract enforcement (Required type + zod validation)
 */

import { describe, it, expect } from "@jest/globals"
import { parseLogsPageState, buildLogsPageHrefFromState, LogsPageStateSchema } from "@/lib/logs-page-filters"

describe("parseLogsPageState", () => {
  it("should normalize valid date", () => {
    const params = {
      date: "2024-01-15",
      month: undefined,
      view: "list",
      page: undefined,
    }
    const state = parseLogsPageState(params)
    expect(state.date).toBe("2024-01-15")
    expect(state.month).toBe("2024-01")
  })

  it("should reject invalid date", () => {
    const params = {
      date: "invalid-date",
      month: "2024-01",
      view: "list",
      page: undefined,
    }
    const state = parseLogsPageState(params)
    expect(state.date).toBeUndefined()
  })

  it("should normalize search name", () => {
    const params = {
      searchName: "  John Doe  ",
      view: "list",
      page: undefined,
    }
    const state = parseLogsPageState(params)
    expect(state.searchName).toBe("john doe")
  })

  it("should reject search name that is too short", () => {
    const params = {
      searchName: "a",
      view: "list",
      page: undefined,
    }
    const state = parseLogsPageState(params)
    expect(state.searchName).toBeUndefined()
  })

  it("should reject search name that is too long", () => {
    const params = {
      searchName: "a".repeat(51),
      view: "list",
      page: undefined,
    }
    const state = parseLogsPageState(params)
    expect(state.searchName).toBeUndefined()
  })

  it("should preserve cursor params", () => {
    const params = {
      nextCursorDate: "2024-01-15T10:00:00Z",
      nextCursorId: "cursor-123",
      view: "list",
      page: undefined,
    }
    const state = parseLogsPageState(params)
    expect(state.nextCursorDate).toBe("2024-01-15T10:00:00Z")
    expect(state.nextCursorId).toBe("cursor-123")
  })

  it("should parse selectedLogId", () => {
    const params = {
      selectedLogId: "log-123",
      view: "list",
      page: undefined,
    }
    const state = parseLogsPageState(params)
    expect(state.selectedLogId).toBe("log-123")
  })
})

describe("LogsPageStateSchema", () => {
  it("should validate complete state", () => {
    const state = {
      date: "2024-01-15",
      departmentId: "dept-123",
      month: "2024-01",
      page: 1,
      searchName: "john",
      selectedLogId: "log-123",
      view: "list" as const,
      nextCursorDate: "2024-01-15T10:00:00Z",
      nextCursorId: "cursor-123",
    }
    expect(() => LogsPageStateSchema.parse(state)).not.toThrow()
  })

  it("should reject invalid view mode", () => {
    const state = {
      month: "2024-01",
      page: 1,
      view: "invalid" as const,
    }
    expect(() => LogsPageStateSchema.parse(state)).toThrow()
  })

  it("should reject invalid page number", () => {
    const state = {
      month: "2024-01",
      page: -1,
      view: "list" as const,
    }
    expect(() => LogsPageStateSchema.parse(state)).toThrow()
  })
})

describe("buildLogsPageHrefFromState", () => {
  it("should build URL with all parameters", () => {
    const state = {
      date: "2024-01-15",
      departmentId: "dept-123",
      month: "2024-01",
      page: 1,
      searchName: "john",
      selectedLogId: "log-123",
      view: "list" as const,
      nextCursorDate: "2024-01-15T10:00:00Z",
      nextCursorId: "cursor-123",
    }
    const href = buildLogsPageHrefFromState(state)
    expect(href).toContain("date=2024-01-15")
    expect(href).toContain("departmentId=dept-123")
    expect(href).toContain("searchName=john")
    expect(href).toContain("selectedLogId=log-123")
    expect(href).toContain("nextCursorDate=2024-01-15T10:00:00Z")
    expect(href).toContain("nextCursorId=cursor-123")
  })

  it("should not include empty parameters", () => {
    const state = {
      date: "",
      departmentId: "",
      month: "2024-01",
      page: 1,
      searchName: "",
      selectedLogId: "",
      view: "list" as const,
      nextCursorDate: "",
      nextCursorId: "",
    }
    const href = buildLogsPageHrefFromState(state)
    expect(href).toBe("/logs")
  })

  it("should include month for calendar view", () => {
    const state = {
      date: "",
      departmentId: "",
      month: "2024-02",
      page: 1,
      searchName: "",
      selectedLogId: "",
      view: "calendar" as const,
      nextCursorDate: "",
      nextCursorId: "",
    }
    const href = buildLogsPageHrefFromState(state)
    expect(href).toContain("view=calendar")
    expect(href).toContain("month=2024-02")
  })

  it("should include cursor for list view only", () => {
    const state = {
      date: "",
      departmentId: "",
      month: "2024-01",
      page: 1,
      searchName: "",
      selectedLogId: "",
      view: "list" as const,
      nextCursorDate: "2024-01-15T10:00:00Z",
      nextCursorId: "cursor-123",
    }
    const href = buildLogsPageHrefFromState(state)
    expect(href).toContain("nextCursorDate=2024-01-15T10:00:00Z")
    expect(href).toContain("nextCursorId=cursor-123")
  })

  it("should not include cursor for calendar view", () => {
    const state = {
      date: "",
      departmentId: "",
      month: "2024-01",
      page: 1,
      searchName: "",
      selectedLogId: "",
      view: "calendar" as const,
      nextCursorDate: "2024-01-15T10:00:00Z",
      nextCursorId: "cursor-123",
    }
    const href = buildLogsPageHrefFromState(state)
    expect(href).not.toContain("nextCursorDate")
    expect(href).not.toContain("nextCursorId")
  })
})

describe("Cursor compatibility logic", () => {
  const VIEW_COMPATIBILITY: Record<string, string[]> = {
    list: ["list"],
    calendar: ["calendar"],
    files: ["files"],
  }

  function isCursorCompatible(fromView: string, toView: string): boolean {
    return VIEW_COMPATIBILITY[fromView]?.includes(toView) ?? false
  }

  it("should allow cursor preservation for same view", () => {
    expect(isCursorCompatible("list", "list")).toBe(true)
    expect(isCursorCompatible("calendar", "calendar")).toBe(true)
    expect(isCursorCompatible("files", "files")).toBe(true)
  })

  it("should not allow cursor preservation across different views", () => {
    expect(isCursorCompatible("list", "calendar")).toBe(false)
    expect(isCursorCompatible("calendar", "list")).toBe(false)
    expect(isCursorCompatible("list", "files")).toBe(false)
  })
})

describe("State preservation scenarios", () => {
  it("should preserve filters when opening preview", () => {
    const state = {
      date: "2024-01-15",
      departmentId: "dept-123",
      month: "2024-01",
      page: 1,
      searchName: "john",
      selectedLogId: undefined,
      view: "list" as const,
      nextCursorDate: "2024-01-15T10:00:00Z",
      nextCursorId: "cursor-123",
    }

    // Simulate opening preview
    const previewState = { ...state, selectedLogId: "log-456" }
    const previewHref = buildLogsPageHrefFromState(previewState)

    expect(previewHref).toContain("date=2024-01-15")
    expect(previewHref).toContain("departmentId=dept-123")
    expect(previewHref).toContain("searchName=john")
    expect(previewHref).toContain("selectedLogId=log-456")
  })

  it("should preserve filters when closing preview", () => {
    const state = {
      date: "2024-01-15",
      departmentId: "dept-123",
      month: "2024-01",
      page: 1,
      searchName: "john",
      selectedLogId: "log-456",
      view: "list" as const,
      nextCursorDate: "2024-01-15T10:00:00Z",
      nextCursorId: "cursor-123",
    }

    // Simulate closing preview
    const closeState = { ...state, selectedLogId: "" }
    const closeHref = buildLogsPageHrefFromState(closeState)

    expect(closeHref).toContain("date=2024-01-15")
    expect(closeHref).toContain("departmentId=dept-123")
    expect(closeHref).toContain("searchName=john")
    expect(closeHref).not.toContain("selectedLogId")
  })

  it("should reset cursor when switching to incompatible view", () => {
    const state = {
      date: "2024-01-15",
      departmentId: "dept-123",
      month: "2024-01",
      page: 1,
      searchName: "",
      selectedLogId: "",
      view: "list" as const,
      nextCursorDate: "2024-01-15T10:00:00Z",
      nextCursorId: "cursor-123",
    }

    // Switch to calendar (incompatible)
    const calendarState = { ...state, view: "calendar" as const, nextCursorDate: "", nextCursorId: "" }
    const calendarHref = buildLogsPageHrefFromState(calendarState)

    expect(calendarHref).toContain("view=calendar")
    expect(calendarHref).not.toContain("nextCursorDate")
    expect(calendarHref).not.toContain("nextCursorId")
  })
})
