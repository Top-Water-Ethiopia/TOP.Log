import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import { EntryKindDropdown } from "@/components/entry-kind-dropdown"
import { SWRConfig } from "swr"

jest.mock("next/navigation", () => ({
  usePathname: () => "/logs/new",
}))

// Mock the use-entry-kinds hook
jest.mock("@/hooks/use-entry-kinds", () => ({
  useScopeEntryKinds: jest.fn(),
}))

// Mock the getEntryKindLabel function
jest.mock("@/lib/entry-kinds", () => ({
  getEntryKindLabel: (key: string) => {
    const labels: Record<string, string> = {
      standard: "Standard Report",
      agent_call: "Agent Call",
      daily_summary: "Daily Summary",
      major_activity: "Major Activity",
    }
    return labels[key] || key
  },
}))

import { useScopeEntryKinds } from "@/hooks/use-entry-kinds"

const mockUseScopeEntryKinds = useScopeEntryKinds as jest.MockedFunction<typeof useScopeEntryKinds>

describe("EntryKindDropdown", () => {
  const mockOnChange = jest.fn()
  const testDate = "2026-03-31"
  const renderWithSWR = (ui: React.ReactElement) =>
    render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{ui}</SWRConfig>)

  beforeEach(() => {
    jest.clearAllMocks()
    // Reset fetch mock
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("renders loading state initially", () => {
    mockUseScopeEntryKinds.mockReturnValue({
      entryKinds: [],
      isLoading: true,
      mutate: jest.fn(),
    })

    renderWithSWR(
      <EntryKindDropdown
        departmentId="dept-123"
        role="sales_promoter"
        date={testDate}
        value={null}
        onChange={mockOnChange}
      />
    )

    expect(screen.getByText("Loading report types...")).toBeInTheDocument()
  })

  it("makes only one API request per department/role change", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { entry_kind: "standard", label: "Standard" },
          { entry_kind: "major_activity", label: "Major Activity" },
        ],
      }),
    })
    global.fetch = mockFetch

    mockUseScopeEntryKinds.mockReturnValue({
      entryKinds: [
        { id: "ek1", entry_kind: "standard", label: "Standard", sort_order: 0, is_active: true, color: "#3B82F6" },
        { id: "ek2", entry_kind: "major_activity", label: "Major Activity", sort_order: 1, is_active: true, color: "#8B5CF6" },
      ],
      isLoading: false,
      mutate: jest.fn(),
    })

    const { rerender } = renderWithSWR(
      <EntryKindDropdown departmentId="dept-123" role="sales_promoter" date={testDate} value={null} onChange={mockOnChange} />
    )

    // Wait for initial fetch
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })
    const initialCallCount = mockFetch.mock.calls.length

    // Re-render with same props - should NOT trigger new API calls
    rerender(<EntryKindDropdown departmentId="dept-123" role="sales_promoter" date={testDate} value={null} onChange={mockOnChange} />)

    const samePropsCallCount = mockFetch.mock.calls.length

    // Re-render with different value - should NOT trigger new API calls
    rerender(
      <EntryKindDropdown departmentId="dept-123" role="sales_promoter" date={testDate} value="standard" onChange={mockOnChange} />
    )

    await waitFor(() => {
      expect(mockFetch.mock.calls.length).toBe(samePropsCallCount)
    })
    expect(samePropsCallCount).toBeGreaterThanOrEqual(initialCallCount)
  })

  it("fetches new data when department changes", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ entry_kind: "standard", label: "Standard" }] }),
    })
    global.fetch = mockFetch

    mockUseScopeEntryKinds.mockReturnValue({
      entryKinds: [
        { id: "ek1", entry_kind: "standard", label: "Standard", sort_order: 0, is_active: true, color: "#3B82F6" },
      ],
      isLoading: false,
      mutate: jest.fn(),
    })

    const { rerender } = renderWithSWR(
      <EntryKindDropdown departmentId="dept-123" role="sales_promoter" date={testDate} value={null} onChange={mockOnChange} />
    )

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    // Change department - should trigger new fetch
    mockUseScopeEntryKinds.mockReturnValue({
      entryKinds: [
        { id: "ek1", entry_kind: "standard", label: "Standard", sort_order: 0, is_active: true, color: "#3B82F6" },
        { id: "ek2", entry_kind: "agent_call", label: "Agent Call", sort_order: 1, is_active: true, color: "#8B5CF6" },
      ],
      isLoading: false,
      mutate: jest.fn(),
    })

    rerender(
      <EntryKindDropdown
        departmentId="dept-456"
        role="sales_promoter"
        date={testDate}
        value={null}
        onChange={mockOnChange}
      />
    )

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  it("shows no available types message when no entry kinds have questions", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    })
    global.fetch = mockFetch

    mockUseScopeEntryKinds.mockReturnValue({
      entryKinds: [
        { id: "ek1", entry_kind: "standard", label: "Standard", sort_order: 0, is_active: true, color: "#3B82F6" },
      ],
      isLoading: false,
      mutate: jest.fn(),
    })

    renderWithSWR(
      <EntryKindDropdown
        departmentId="dept-123"
        role="sales_promoter"
        date={testDate}
        value={null}
        onChange={mockOnChange}
      />
    )

    await waitFor(() => {
      expect(screen.getByText("No report types available for your role in this department.")).toBeInTheDocument()
    })
  })

  it("auto-selects single available entry kind", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ entry_kind: "major_activity", label: "Major Activity" }],
      }),
    })
    global.fetch = mockFetch

    mockUseScopeEntryKinds.mockReturnValue({
      entryKinds: [
        { id: "ek1", entry_kind: "major_activity", label: "Major Activity", sort_order: 0, is_active: true, color: "#8B5CF6" },
      ],
      isLoading: false,
      mutate: jest.fn(),
    })

    renderWithSWR(
      <EntryKindDropdown
        departmentId="dept-123"
        role="sales_promoter"
        date={testDate}
        value={null}
        onChange={mockOnChange}
      />
    )

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith("major_activity")
    })
  })

  it("shows the configured label for a renamed standard entry kind", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ entry_kind: "standard", label: "Agent Contact" }],
      }),
    })
    global.fetch = mockFetch

    mockUseScopeEntryKinds.mockReturnValue({
      entryKinds: [
        { id: "ek1", entry_kind: "standard", label: "Agent Contact", sort_order: 0, is_active: true, color: "#3B82F6" },
      ],
      isLoading: false,
      mutate: jest.fn(),
    })

    renderWithSWR(
      <EntryKindDropdown
        departmentId="dept-123"
        role="sales_promoter"
        date={testDate}
        value="standard"
        onChange={mockOnChange}
      />
    )

    await waitFor(() => {
      expect(screen.getByText("Agent Contact")).toBeInTheDocument()
    })

    expect(screen.queryByText("Standard Report")).not.toBeInTheDocument()
  })

  it("calls onChange when user selects different entry kind", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { entry_kind: "standard", label: "Standard" },
          { entry_kind: "major_activity", label: "Major Activity" },
        ],
      }),
    })
    global.fetch = mockFetch

    mockUseScopeEntryKinds.mockReturnValue({
      entryKinds: [
        { id: "ek1", entry_kind: "standard", label: "Standard", sort_order: 0, is_active: true, color: "#3B82F6" },
        { id: "ek2", entry_kind: "major_activity", label: "Major Activity", sort_order: 1, is_active: true, color: "#8B5CF6" },
      ],
      isLoading: false,
      mutate: jest.fn(),
    })

    renderWithSWR(
      <EntryKindDropdown
        departmentId="dept-123"
        role="sales_promoter"
        date={testDate}
        value="standard"
        onChange={mockOnChange}
      />
    )

    await waitFor(() => {
      expect(screen.getByText("Report Type")).toBeInTheDocument()
    })

    // Open the select
    const selectTrigger = screen.getByRole("combobox")
    fireEvent.click(selectTrigger)

    // Select a different option
    const majorActivityOption = screen.getByText("Major Activity")
    fireEvent.click(majorActivityOption)

    expect(mockOnChange).toHaveBeenCalledWith("major_activity")
  })

  it("auto-selects the only reachable active entry kind returned by the API", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ entry_kind: "standard", label: "Standard" }],
      }),
    })
    global.fetch = mockFetch

    mockUseScopeEntryKinds.mockReturnValue({
      entryKinds: [
        { id: "ek1", entry_kind: "standard", label: "Standard", sort_order: 0, is_active: true, color: "#3B82F6" },
        { id: "ek2", entry_kind: "agent_call", label: "Agent Call", sort_order: 1, is_active: false, color: "#8B5CF6" }, // Inactive
      ],
      isLoading: false,
      mutate: jest.fn(),
    })

    renderWithSWR(
      <EntryKindDropdown
        departmentId="dept-123"
        role="sales_promoter"
        date={testDate}
        value={null}
        onChange={mockOnChange}
      />
    )

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith("standard")
    })
  })

  it("constructs correct API URLs for department and role scopes", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ entry_kind: "standard", label: "Standard" }] }),
    })
    global.fetch = mockFetch

    mockUseScopeEntryKinds.mockReturnValue({
      entryKinds: [
        { id: "ek1", entry_kind: "standard", label: "Standard", sort_order: 0, is_active: true, color: "#3B82F6" },
      ],
      isLoading: false,
      mutate: jest.fn(),
    })

    renderWithSWR(
      <EntryKindDropdown
        departmentId="dept-abc-123"
        role="sales_promoter"
        date={testDate}
        value={null}
        onChange={mockOnChange}
      />
    )

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    const calls = mockFetch.mock.calls
    expect(calls[0][0]).toContain("departmentId=dept-abc-123")
    expect(calls[0][0]).toContain("role=sales_promoter")
  })

})
